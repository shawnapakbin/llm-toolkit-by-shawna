/**
 * Agent Runner Tests
 */

import { AgentRunner, ExecutionMode, Workflow, RetryPolicy } from "../src/runner";
import { ToolRegistry, ToolMetadata, ToolStatus } from "../src/registry";
import { ErrorCode } from "@shared/types";

// Mock fetch globally
global.fetch = jest.fn();

/**
 * Helper to create mock tool metadata
 */
function createMockTool(
  id: string,
  port: number,
  handler: (input: any) => Promise<any>
): ToolMetadata & { handler: (input: any) => Promise<any> } {
  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    description: `Mock ${id}`,
    version: "1.0.0",
    capabilities: [],
    httpEndpoint: `http://localhost:${port}`,
    healthEndpoint: `http://localhost:${port}/health`,
    schemaEndpoint: `http://localhost:${port}/schema`,
    status: ToolStatus.HEALTHY,
    handler,
  } as any;
}

/**
 * Setup fetch mock to use tool handlers
 */
function setupFetchMock(registry: ToolRegistry): void {
  (global.fetch as jest.Mock).mockImplementation(async (url: string, options: any) => {
    const body = JSON.parse(options.body || "{}");
    const signal = options.signal as AbortSignal | undefined;
    
    // Check if already aborted
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    
    // Extract tool ID from URL (e.g., http://localhost:3330/endpoint -> tool with port 3330)
    const urlObj = new URL(url);
    const port = parseInt(urlObj.port);
    
    // Find tool by port number
    const tools = registry.getAllTools() as Array<ToolMetadata & { handler?: (input: any) => Promise<any> }>;
    const tool = tools.find(t => {
      const toolUrlObj = new URL(t.httpEndpoint);
      return parseInt(toolUrlObj.port) === port;
    });
    
    if (!tool || !tool.handler) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ success: false, error: "Tool not found" }),
      };
    }
    
    try {
      // Create a promise that races between the handler and abort signal
      const handlerPromise = tool.handler(body);
      
      if (signal) {
        const abortPromise = new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new DOMException("Aborted", "AbortError"));
          } else {
            signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
        });
        
        const result = await Promise.race([handlerPromise, abortPromise]);
        return {
          ok: result.success !== false,
          status: result.success !== false ? 200 : 500,
          json: async () => result,
        };
      } else {
        const result = await handlerPromise;
        return {
          ok: result.success !== false,
          status: result.success !== false ? 200 : 500,
          json: async () => result,
        };
      }
    } catch (error) {
      // If the error is due to abort/timeout, throw it so fetch catches it
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      
      return {
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      };
    }
  });
}

describe("AgentRunner", () => {
  let registry: ToolRegistry;
  let runner: AgentRunner;

  beforeEach(() => {
    registry = new ToolRegistry();
    runner = new AgentRunner(registry);
    jest.clearAllMocks();
    setupFetchMock(registry);
  });

  describe("Sequential Execution", () => {
    test("executes steps in order", async () => {
      const executionOrder: string[] = [];

      // Register mock tools
      registry.register(createMockTool("tool1", 3330, async (_input: any) => {
        executionOrder.push("tool1");
        return { success: true, data: { result: "from tool1" } };
      }));

      registry.register(createMockTool("tool2", 3331, async (_input: any) => {
        executionOrder.push("tool2");
        return { success: true, data: { result: "from tool2" } };
      }));

      const workflow: Workflow = {
        id: "sequential-test",
        name: "Sequential Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "tool1", endpoint: "/tool1", input: {} },
          { id: "step2", toolId: "tool2", endpoint: "/tool2", input: {} },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(["tool1", "tool2"]);
      expect(result.steps).toHaveLength(2);
    });

    test("respects step dependencies", async () => {
      const executionOrder: string[] = [];

      registry.register(createMockTool("tool1", 3330, async (_input: any) => {
        executionOrder.push("tool1");
        return { success: true, data: { value: 10 } };
      }));

      registry.register(createMockTool("tool2", 3331, async (input: any) => {
        executionOrder.push("tool2");
        // Input is the raw POST body, which includes the merged dependency data
        expect(input.value).toBe(10); // Verify dependency data was merged
        return { success: true, data: { result: input.value * 2 } };
      }));

      const workflow: Workflow = {
        id: "dependency-test",
        name: "Dependency Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "tool1", endpoint: "/tool1", input: {} },
          {
            id: "step2",
            toolId: "tool2",
            endpoint: "/tool2",
            input: {},
            dependsOn: ["step1"],
          },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(executionOrder).toEqual(["tool1", "tool2"]);
    });

    test("stops on first failure", async () => {
      const executionOrder: string[] = [];

      registry.register(createMockTool("tool1", 3330, async () => {
        executionOrder.push("tool1");
        return {
          success: false,
          error: {
            code: ErrorCode.EXECUTION_FAILED,
            message: "Tool 1 failed",
          },
        };
      }));

      registry.register(createMockTool("tool2", 3331, async () => {
        executionOrder.push("tool2");
        return { success: true, data: {} };
      }));

      const workflow: Workflow = {
        id: "failure-test",
        name: "Failure Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "tool1", endpoint: "/tool1", input: {} },
          { id: "step2", toolId: "tool2", endpoint: "/tool2", input: {} },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(executionOrder).toEqual(["tool1"]); // tool2 should not execute
      expect(result.steps).toHaveLength(1);
    });
  });

  describe("Parallel Execution", () => {
    test("executes independent steps concurrently", async () => {
      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      registry.register(createMockTool("tool1", 3330, async () => {
        startTimes.tool1 = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));
        endTimes.tool1 = Date.now();
        return { success: true, data: { result: "tool1" } };
      }));

      registry.register(createMockTool("tool2", 3331, async () => {
        startTimes.tool2 = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));
        endTimes.tool2 = Date.now();
        return { success: true, data: { result: "tool2" } };
      }));

      const workflow: Workflow = {
        id: "parallel-test",
        name: "Parallel Test",
        mode: ExecutionMode.PARALLEL,
        steps: [
          { id: "step1", toolId: "tool1", endpoint: "/tool1", input: {} },
          { id: "step2", toolId: "tool2", endpoint: "/tool2", input: {} },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(2);
      
      // Verify they ran concurrently (started at roughly the same time)
      const timeDiff = Math.abs(startTimes.tool1 - startTimes.tool2);
      expect(timeDiff).toBeLessThan(50); // Should start within 50ms
    });

    test("collects all results including failures", async () => {
      registry.register(createMockTool("tool1", 3330, async () => {
        return { success: true, data: { result: "success" } };
      }));

      registry.register(createMockTool("tool2", 3331, async () => {
        return {
          success: false,
          error: {
            code: ErrorCode.EXECUTION_FAILED,
            message: "Failed",
          },
        };
      }));

      const workflow: Workflow = {
        id: "parallel-failure-test",
        name: "Parallel Failure Test",
        mode: ExecutionMode.PARALLEL,
        steps: [
          { id: "step1", toolId: "tool1", endpoint: "/tool1", input: {} },
          { id: "step2", toolId: "tool2", endpoint: "/tool2", input: {} },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].success).toBe(true);
      expect(result.steps[1].success).toBe(false);
    });
  });

  describe("Retry Logic", () => {
    test("retries on failure with exponential backoff", async () => {
      let attemptCount = 0;
      const attemptTimes: number[] = [];

      registry.register(createMockTool("flaky-tool", 3330, async () => {
        attemptCount++;
        attemptTimes.push(Date.now());
        
        if (attemptCount < 3) {
          return {
            success: false,
            error: {
              code: ErrorCode.EXECUTION_FAILED,
              message: `Attempt ${attemptCount} failed`,
            },
          };
        }
        
        return { success: true, data: { result: "success on attempt 3" } };
      }));

      const retryPolicy: RetryPolicy = {
        maxRetries: 3,
        retryDelayMs: 100,
        backoffMultiplier: 2,
      };

      const workflow: Workflow = {
        id: "retry-test",
        name: "Retry Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "flaky-tool", endpoint: "/flaky", input: {}, retryPolicy },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
      expect(result.steps[0].retries).toBe(2); // 2 retries after initial attempt
      
      // Verify exponential backoff
      if (attemptTimes.length >= 3) {
        const delay1 = attemptTimes[1] - attemptTimes[0];
        const delay2 = attemptTimes[2] - attemptTimes[1];
        
        // Second delay should be roughly 2x first delay (backoff multiplier)
        expect(delay2).toBeGreaterThan(delay1 * 1.5);
      }
    });

    test("gives up after max retries", async () => {
      let attemptCount = 0;

      registry.register(createMockTool("always-fails", 3330, async () => {
        attemptCount++;
        return {
          success: false,
          error: {
            code: ErrorCode.EXECUTION_FAILED,
            message: "Always fails",
          },
        };
      }));

      const retryPolicy: RetryPolicy = {
        maxRetries: 2,
        retryDelayMs: 50,
      };

      const workflow: Workflow = {
        id: "max-retry-test",
        name: "Max Retry Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "always-fails", endpoint: "/fails", input: {}, retryPolicy },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(attemptCount).toBe(3); // Initial + 2 retries
      expect(result.steps[0].retries).toBe(2);
    });
  });

  describe("Workflow Cancellation", () => {
    test("cancels running workflow", async () => {
      let tool1Started = false;
      let tool2Started = false;

      registry.register(createMockTool("slow-tool", 3330, async () => {
        tool1Started = true;
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return { success: true, data: {} };
      }));

      registry.register(createMockTool("tool2", 3331, async () => {
        tool2Started = true;
        return { success: true, data: {} };
      }));

      const workflow: Workflow = {
        id: "cancel-test",
        name: "Cancel Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "slow-tool", endpoint: "/slow", input: {} },
          { id: "step2", toolId: "tool2", endpoint: "/tool2", input: {} },
        ],
      };

      const resultPromise = runner.executeWorkflow(workflow);
      
      // Cancel after a short delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      const cancelled = runner.cancelWorkflow("cancel-test");
      expect(cancelled).toBe(true);
      
      const result = await resultPromise;
      
      // Workflow should be marked as failed/cancelled
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(tool1Started).toBe(true);
      // tool2 should not start since workflow was cancelled
      expect(tool2Started).toBe(false);
    }, 10000);

    test("lists running workflows", async () => {
      registry.register(createMockTool("long-tool", 3330, async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return { success: true, data: {} };
      }));

      const workflow: Workflow = {
        id: "running-test",
        name: "Running Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "long-tool", endpoint: "/long", input: {} },
        ],
      };

      const promise = runner.executeWorkflow(workflow);
      
      // Check running workflows mid-execution
      await new Promise((resolve) => setTimeout(resolve, 100));
      const running = runner.getRunningWorkflows();
      
      expect(running).toContain("running-test");
      
      await promise;
      
      const runningAfter = runner.getRunningWorkflows();
      expect(runningAfter).not.toContain("running-test");
    }, 5000);
  });

  describe("Workflow Timeout", () => {
    test("enforces global workflow timeout", async () => {
      registry.register(createMockTool("very-slow-tool", 3330, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { success: true, data: {} };
      }));

      const workflow: Workflow = {
        id: "timeout-test",
        name: "Timeout Test",
        mode: ExecutionMode.SEQUENTIAL,
        timeoutMs: 500, // 500ms timeout
        steps: [
          { id: "step1", toolId: "very-slow-tool", endpoint: "/veryslow", input: {} },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/timeout|timed out/i);
    }, 10000);
  });

  describe("Error Handling", () => {
    test("handles missing tool gracefully", async () => {
      const workflow: Workflow = {
        id: "missing-tool-test",
        name: "Missing Tool Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "nonexistent", endpoint: "/none", input: {} },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.steps[0].errorCode).toBe(ErrorCode.NOT_FOUND);
    });

    test("provides detailed error information", async () => {
      registry.register(createMockTool("error-tool", 3330, async () => {
        throw new Error("Unexpected error");
      }));

      const workflow: Workflow = {
        id: "error-test",
        name: "Error Test",
        mode: ExecutionMode.SEQUENTIAL,
        steps: [
          { id: "step1", toolId: "error-tool", endpoint: "/error", input: {} },
        ],
      };

      const result = await runner.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.steps[0].success).toBe(false);
      expect(result.steps[0].errorMessage).toBeDefined();
    });
  });
});
