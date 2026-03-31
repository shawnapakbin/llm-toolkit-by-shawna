# Requirements Document

## Introduction

This document defines the requirements for upgrading the `WebBrowser` tool from a static
`fetch` + regex HTML parser (v1.0.0) to a full headless Chromium browser powered by Playwright
(v2.1.0). The upgrade enables JavaScript-rendered pages, SPAs, and dynamic content while
preserving full backward compatibility with existing callers. The MCP tool name (`browse_web`),
HTTP port (3334), and response envelope shape are unchanged.

## Glossary

- **WebBrowser**: The MCP tool and HTTP service that fetches and extracts content from web pages.
- **BrowserPool**: A module-level singleton that manages a single long-lived Playwright `Browser` instance.
- **browseWeb**: The core orchestration function in `browser.ts` that performs a single page visit.
- **extractContent**: An in-page function executed via `page.evaluate()` that extracts structured content from the live DOM.
- **Playwright**: The browser automation library used to drive headless Chromium.
- **Page**: A Playwright `Page` object representing a single browser tab, created per request and closed after use.
- **Browser**: A Playwright `Browser` instance (Chromium), shared across all requests via `BrowserPool`.
- **Policy**: The `policy.ts` module responsible for SSRF protection and content-type allowlisting.
- **SSRF**: Server-Side Request Forgery — a class of attack where the server is tricked into making requests to internal/private network addresses.
- **BrowseInput**: The input type accepted by `browseWeb`, including URL, timeout, content limits, and optional v2.1.0 fields.
- **BrowseResult**: The output type returned by `browseWeb`, containing page content, metadata, and optional screenshot.
- **CookieDef**: A cookie definition object with `name`, `value`, and `domain` fields.
- **outputFormat**: The content extraction mode — either `'text'` (plain) or `'markdown'`.
- **waitForSelector**: An optional CSS selector that `browseWeb` waits for before extracting content.
- **networkidle**: A Playwright wait strategy that waits until no network requests have been made for 500ms.
- **domcontentloaded**: A Playwright wait strategy that waits until the DOM is parsed (default).

---

## Requirements

### Requirement 1: Playwright-Powered Page Navigation

**User Story:** As a caller of the `browse_web` tool, I want pages to be loaded using a real
headless Chromium browser, so that JavaScript-rendered content and SPAs are accessible.

#### Acceptance Criteria

1. WHEN `browseWeb` is called with a valid URL, THE `BrowserPool` SHALL provide a `Page` on a shared Playwright Chromium `Browser` instance.
2. WHEN a page navigation completes, THE `browseWeb` function SHALL extract content using `page.evaluate()` against the live DOM rather than raw HTML string parsing.
3. WHEN `waitForNetworkIdle` is `true`, THE `browseWeb` function SHALL use the `networkidle` wait strategy for `page.goto()`.
4. WHEN `waitForNetworkIdle` is `false` or omitted, THE `browseWeb` function SHALL use the `domcontentloaded` wait strategy for `page.goto()`.
5. THE `BrowserPool` SHALL reuse a single `Browser` instance across all requests within a process lifetime.
6. WHEN `browseWeb` completes (success or failure), THE `browseWeb` function SHALL close the `Page` in a `finally` block.

---

### Requirement 2: Browser Pool Lifecycle Management

**User Story:** As a system operator, I want the Playwright browser instance to be managed
efficiently, so that startup cost is paid once and resources are released on shutdown.

#### Acceptance Criteria

1. WHEN the first request arrives and no `Browser` is running, THE `BrowserPool` SHALL launch Chromium exactly once.
2. WHEN multiple concurrent requests arrive before the `Browser` has finished launching, THE `BrowserPool` SHALL serialize the launch so that `chromium.launch()` is called at most once.
3. WHEN the process receives a `SIGTERM` or `SIGINT` signal or a normal `exit` event, THE `BrowserPool` SHALL call `browser.close()` to release the Chromium process.
4. WHEN `BROWSER_HEADLESS` environment variable is set to `"false"`, THE `BrowserPool` SHALL launch Chromium in headed mode.
5. WHEN `BROWSER_EXECUTABLE_PATH` environment variable is set, THE `BrowserPool` SHALL use that path as the Chromium executable.
6. WHEN the `Browser` disconnects unexpectedly, THE `BrowserPool` SHALL null the instance so the next request triggers a fresh launch.

---

### Requirement 3: SSRF Policy Enforcement

**User Story:** As a security engineer, I want all URL requests to be validated against the
SSRF policy before any browser activity, so that private and internal network addresses cannot
be reached.

#### Acceptance Criteria

1. WHEN `browseWeb` is called, THE `browseWeb` function SHALL invoke `validateTargetUrl(url)` before calling `BrowserPool.getPage()`.
2. IF `validateTargetUrl` returns `{ ok: false }`, THEN THE `browseWeb` function SHALL return a `BrowseResult` with `success: false` and `errorCode` matching the policy error code without invoking Playwright.
3. THE `Policy` SHALL block URLs with `localhost`, `127.0.0.1`, `::1`, RFC-1918 private ranges (10.x.x.x, 172.16–31.x.x, 192.168.x.x), and link-local (169.254.x.x) hostnames.
4. THE `Policy` SHALL reject URLs whose protocol is not `http:` or `https:`.
5. IF a URL fails policy validation, THEN THE `browseWeb` function SHALL return `errorCode: "POLICY_BLOCKED"` for blocked hosts and `errorCode: "INVALID_INPUT"` for invalid URLs.

---

### Requirement 4: Content-Type Enforcement

**User Story:** As a security engineer, I want only permitted content types to be processed,
so that binary blobs and unsupported formats are rejected before content extraction.

#### Acceptance Criteria

1. WHEN a page navigation completes, THE `browseWeb` function SHALL inspect the `content-type` response header from Playwright's `Response` object.
2. IF the `content-type` is not in the allowed list, THEN THE `browseWeb` function SHALL return `{ success: false, errorCode: "POLICY_BLOCKED" }` without calling `page.evaluate()`.
3. THE `Policy` SHALL allow the following content types: `text/html`, `text/plain`, `application/xhtml+xml`, `application/xml`, `application/json`.
4. IF the `content-type` header is absent, THEN THE `Policy` SHALL treat the content type as allowed.

---

### Requirement 5: DOM-Based Content Extraction

**User Story:** As a caller, I want page content extracted from the live DOM, so that
JavaScript-rendered text is captured and HTML entities are decoded natively.

#### Acceptance Criteria

1. WHEN extracting content, THE `extractContent` function SHALL remove `<script>`, `<style>`, `<noscript>`, and `<svg>` subtrees before traversal.
2. THE `extractContent` function SHALL set the `title` field to `document.title`.
3. WHEN `outputFormat` is `'text'` or omitted, THE `extractContent` function SHALL return whitespace-normalized plain text.
4. WHEN `outputFormat` is `'markdown'`, THE `extractContent` function SHALL format `<h1>`–`<h6>` elements as `# `–`###### ` prefixed lines matching the heading level.
5. WHEN `outputFormat` is `'markdown'`, THE `extractContent` function SHALL format `<a>` elements as `[text](href)`.
6. WHEN `outputFormat` is `'markdown'`, THE `extractContent` function SHALL format `<li>` elements as `- item` lines.
7. WHEN `outputFormat` is `'markdown'`, THE `extractContent` function SHALL format `<strong>` and `<b>` elements as `**text**`.
8. WHEN `outputFormat` is `'markdown'`, THE `extractContent` function SHALL format `<em>` and `<i>` elements as `_text_`.
9. THE `extractContent` function SHALL rely on the browser DOM to decode HTML entities natively, producing decoded characters in the output.

---

### Requirement 6: Content Truncation

**User Story:** As a caller, I want content to be truncated to a configurable limit, so that
responses remain within token budgets for LLM consumption.

#### Acceptance Criteria

1. WHEN navigation succeeds, THE `browseWeb` function SHALL truncate `content` to at most `maxContentChars` characters.
2. THE `browseWeb` function SHALL set `contentLength` to the length of `content` after truncation.
3. WHEN `BROWSER_MAX_CONTENT_CHARS` environment variable is set, THE `WebBrowser` SHALL use that value as the default `maxContentChars`.

---

### Requirement 7: Optional Selector Wait

**User Story:** As a caller targeting SPAs, I want to wait for a specific DOM element before
extracting content, so that dynamically rendered sections are present in the output.

#### Acceptance Criteria

1. WHEN `waitForSelector` is provided, THE `browseWeb` function SHALL call `page.waitForSelector(selector, { timeout: timeoutMs })` after navigation completes.
2. WHEN `waitForSelector` is not provided, THE `browseWeb` function SHALL proceed directly to content extraction without waiting for any selector.
3. IF `waitForSelector` is provided and the selector is not found within `timeoutMs`, THEN THE `browseWeb` function SHALL return `{ success: false, errorCode: "TIMEOUT" }`.

---

### Requirement 8: Cookie Injection

**User Story:** As a caller accessing authenticated pages, I want to inject cookies before
navigation, so that session-gated content is accessible.

#### Acceptance Criteria

1. WHEN `cookies` is provided and non-empty, THE `browseWeb` function SHALL call `page.context().addCookies(cookies)` before `page.goto()`.
2. WHEN `cookies` is empty or omitted, THE `browseWeb` function SHALL proceed without injecting any cookies.
3. THE `browseWeb` function SHALL scope injected cookies to the current `Page` context only, so they do not persist to subsequent requests.

---

### Requirement 9: Screenshot Capture

**User Story:** As a caller, I want to optionally capture a screenshot of the rendered page,
so that visual content can be inspected or returned to the user.

#### Acceptance Criteria

1. WHEN `screenshot` is `true` and navigation succeeds, THE `browseWeb` function SHALL call `page.screenshot({ type: 'png', fullPage: false })` and return the result as a base64 string in `screenshotBase64`.
2. WHEN `screenshot` is `false` or omitted, THE `browseWeb` function SHALL omit `screenshotBase64` from the result.
3. IF `page.screenshot()` fails, THEN THE `browseWeb` function SHALL omit `screenshotBase64` and return the navigation result with the original `success` value.

---

### Requirement 10: Error Handling and Result Shape

**User Story:** As a caller, I want all error conditions to return a structured result rather
than throwing, so that error handling is uniform and predictable.

#### Acceptance Criteria

1. THE `browseWeb` function SHALL return a `BrowseResult` in all code paths and SHALL NOT throw exceptions to callers.
2. WHEN `page.goto()` exceeds `timeoutMs`, THE `browseWeb` function SHALL return `{ success: false, errorCode: "TIMEOUT" }`.
3. WHEN any unexpected error occurs during navigation or extraction, THE `browseWeb` function SHALL return `{ success: false, errorCode: "EXECUTION_FAILED", error: <message> }`.
4. WHEN navigation returns an HTTP status ≥ 400, THE `browseWeb` function SHALL set `success: false` and `status` to the HTTP status code.
5. THE `BrowseResult` SHALL always include `success`, `status`, `finalUrl`, `title`, `content`, and `contentLength` fields.

---

### Requirement 11: Post-Redirect URL Tracking

**User Story:** As a caller, I want the final URL after all redirects to be reported, so that
I know the canonical location of the content.

#### Acceptance Criteria

1. WHEN navigation completes, THE `browseWeb` function SHALL set `finalUrl` to `page.url()` at the time of content extraction.
2. WHEN the server issues one or more HTTP redirects, THE `browseWeb` function SHALL report the terminal URL in `finalUrl`, not the original input URL.

---

### Requirement 12: Backward Compatibility

**User Story:** As an existing caller using only `{ url, timeoutMs, maxContentChars }`, I want
the upgrade to be transparent, so that no changes to my integration are required.

#### Acceptance Criteria

1. THE `WebBrowser` tool SHALL expose the MCP tool name `browse_web` unchanged.
2. THE `WebBrowser` service SHALL listen on HTTP port 3334 unchanged.
3. WHEN called with only `{ url, timeoutMs, maxContentChars }`, THE `browseWeb` function SHALL return a `BrowseResult` with the same field shape as v1.0.0.
4. WHEN called with only `{ url, timeoutMs, maxContentChars }`, THE `browseWeb` function SHALL return `screenshotBase64: undefined`.
5. THE `WebBrowser` SHALL pass all existing `WebBrowser/tests/http.test.ts` and `policy.test.ts` tests without modification.

---

### Requirement 13: MCP Schema Extensions

**User Story:** As an LLM agent using the MCP interface, I want the new optional parameters
to be described in the tool schema, so that I can discover and use them correctly.

#### Acceptance Criteria

1. THE `mcp-server.ts` SHALL expose `waitForSelector` as an optional string parameter in the `browse_web` tool schema.
2. THE `mcp-server.ts` SHALL expose `waitForNetworkIdle` as an optional boolean parameter in the `browse_web` tool schema.
3. THE `mcp-server.ts` SHALL expose `screenshot` as an optional boolean parameter in the `browse_web` tool schema.
4. THE `mcp-server.ts` SHALL expose `cookies` as an optional array of `{ name, value, domain }` objects in the `browse_web` tool schema.
5. THE `mcp-server.ts` SHALL expose `outputFormat` as an optional enum of `'text'` or `'markdown'` in the `browse_web` tool schema.

---

### Requirement 14: Environment-Based Configuration

**User Story:** As a system operator, I want browser behavior to be configurable via
environment variables, so that deployment environments can tune timeouts and resource limits
without code changes.

#### Acceptance Criteria

1. WHEN `BROWSER_DEFAULT_TIMEOUT_MS` is set, THE `WebBrowser` SHALL use that value as the default navigation timeout.
2. WHEN `BROWSER_MAX_TIMEOUT_MS` is set, THE `WebBrowser` SHALL cap `timeoutMs` at that value regardless of caller input.
3. WHEN `BROWSER_MAX_CONTENT_CHARS` is set, THE `WebBrowser` SHALL use that value as the default `maxContentChars`.
4. WHEN `BROWSER_HEADLESS` is set to `"false"`, THE `BrowserPool` SHALL launch Chromium in headed mode.
5. WHEN `BROWSER_EXECUTABLE_PATH` is set, THE `BrowserPool` SHALL pass that path to `chromium.launch()` as `executablePath`.
