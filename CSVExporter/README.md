# CSV Exporter Tool

Exports parsed table data into clean CSV files for spreadsheet workflows.

## Features

- MCP stdio server: dist/mcp-server.js
- HTTP server: dist/index.js
- Writes to user Documents folder by default
- Optional subfolder under Documents
- Appends rows to existing CSV by default
- Escapes commas, quotes, and newlines for spreadsheet compatibility

## Build

```bash
npm run build
```

## LM Studio mcp.json

```json
{
  "mcpServers": {
    "csv-exporter": {
      "command": "node",
      "args": ["CSVExporter/dist/mcp-server.js"],
      "env": {
        "CSV_EXPORT_ROOT": ""
      }
    }
  }
}
```

Tip: from repo root run npm run mcp:print-config for ready-to-paste absolute paths.

## MCP Tool

Tool name: save_parsed_data_csv

Input:
- filename (optional)
- subfolder (optional, relative to Documents)
- headers (required)
- rows (required)
- append (optional, defaults to true)

Output:
- success flag
- outputPath
- rowsWritten
- appended and createdNewFile indicators
