#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { randomUUID } from "node:crypto";
import http from "node:http";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { allToolDefs, dispatchTool } from "./tools/index.js";
import { catalogueResource } from "./resources/catalogue.js";
import { allPrompts } from "./prompts/templates.js";

function parseArgs(): { transport: "stdio" | "http"; port: number } {
  const args = process.argv.slice(2);
  let transport: "stdio" | "http" = "stdio";
  let port = 3000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--transport" && args[i + 1]) {
      const val = args[i + 1].toLowerCase();
      if (val === "http" || val === "streamable-http") {
        transport = "http";
      } else if (val === "stdio") {
        transport = "stdio";
      }
      i++;
    } else if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        process.stderr.write("[LINDAS-MCP] ERROR Invalid port number\n");
        process.exit(1);
      }
      i++;
    } else if (args[i] === "--help" || args[i] === "-h") {
      process.stderr.write(
        "Usage: lindas-mcp [--transport stdio|http] [--port PORT]\n\n" +
          "Options:\n" +
          "  --transport stdio|http  Transport mode (default: stdio)\n" +
          "  --port PORT             HTTP port (default: 3000, only for http)\n" +
          "  --help                  Show this help message\n\n" +
          "Environment variables:\n" +
          "  LINDAS_SPARQL_ENDPOINT   SPARQL endpoint URL (default: https://ld.admin.ch/query)\n" +
          "  LINDAS_DEFAULT_LANGUAGE  Default language (default: de)\n" +
          "  LINDAS_TRANSPORT         Transport mode: stdio or http\n" +
          "  LINDAS_PORT               HTTP port (default: 3000)\n" +
          "  LINDAS_HOST               HTTP bind address (default: 0.0.0.0)\n"
      );
      process.exit(0);
    }
  }

  const envTransport = process.env.LINDAS_TRANSPORT?.toLowerCase();
  if (envTransport === "http" || envTransport === "streamable-http") {
    transport = "http";
  }

  const envPort = process.env.LINDAS_PORT;
  if (envPort) {
    const p = parseInt(envPort, 10);
    if (!isNaN(p) && p >= 1 && p <= 65535) {
      port = p;
    }
  }

  return { transport, port };
}

function createServer(): Server {
  const server = new Server(
    { name: "lindas", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allToolDefs.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as any,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const text = await dispatchTool(name, args);
      return {
        content: [{ type: "text", text }],
        isError: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text", text: JSON.stringify({ error: true, message }) }],
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: catalogueResource.uri,
          name: catalogueResource.name,
          description: catalogueResource.description,
          mimeType: catalogueResource.mimeType,
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === catalogueResource.uri) {
      try {
        const text = await catalogueResource.read();
        return {
          contents: [
            {
              uri: catalogueResource.uri,
              mimeType: catalogueResource.mimeType,
              text,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed to read catalogue: ${message}`);
      }
    }
    throw new Error(`Unknown resource: ${uri}`);
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: allPrompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments,
      })),
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const prompt = allPrompts.find((p) => p.name === name);
    if (!prompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }
    const messages = prompt.messages(args ?? {});
    return { messages };
  });

  return server;
}

async function main() {
  const { transport: transportMode, port } = parseArgs();

  if (transportMode === "http") {
    const host = process.env.LINDAS_HOST ?? "0.0.0.0";
    const app = createMcpExpressApp({
      host,
      allowedHosts: ["lindas-mcp", "localhost", "127.0.0.1"],
    });

    const transports: Map<string, StreamableHTTPServerTransport> = new Map();

    const handleSessionRequest = async (
      req: Parameters<StreamableHTTPServerTransport["handleRequest"]>[0],
      res: Parameters<StreamableHTTPServerTransport["handleRequest"]>[1],
      parsedBody?: unknown
    ) => {
      const sessionId = (req.headers["mcp-session-id"] as string) || "";
      const transport = sessionId ? transports.get(sessionId) : undefined;

      if (transport) {
        await transport.handleRequest(req, res, parsedBody);
        return;
      }

      const newTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      const server = createServer();
      await server.connect(newTransport);

      newTransport.onclose = () => {
        if (newTransport.sessionId) {
          transports.delete(newTransport.sessionId);
          process.stderr.write(
            `[LINDAS-MCP] INFO  Session closed: ${newTransport.sessionId}\n`
          );
        }
      };

      await newTransport.handleRequest(req, res, parsedBody);

      if (newTransport.sessionId) {
        transports.set(newTransport.sessionId, newTransport);
        process.stderr.write(
          `[LINDAS-MCP] INFO  Session created: ${newTransport.sessionId}\n`
        );
      }
    };

    app.get("/health", (_req, res) => {
      res.json({ status: "ok", sessions: transports.size });
    });

    app.post("/mcp", (req, res) => {
      handleSessionRequest(req, res, req.body);
    });
    app.get("/mcp", (req, res) => {
      handleSessionRequest(req, res);
    });
    app.delete("/mcp", (req, res) => {
      handleSessionRequest(req, res);
    });

    const httpServer = http.createServer(app);
    httpServer.listen(port, host, () => {
      process.stderr.write(
        `[LINDAS-MCP] INFO  lindas-mcp server started on http://${host}:${port}/mcp (streamable-http)\n`
      );
    });

    const shutdown = () => {
      process.stderr.write("[LINDAS-MCP] INFO  Shutting down...\n");
      for (const [, transport] of transports) {
        transport.close().catch(() => {});
      }
      httpServer.close(() => {
        process.stderr.write("[LINDAS-MCP] INFO  Server stopped\n");
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 5000);
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } else {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("[LINDAS-MCP] INFO  lindas-mcp server started (stdio)\n");
  }
}

main().catch((err) => {
  process.stderr.write(
    `[LINDAS-MCP] ERROR Failed to start server: ${
      err instanceof Error ? err.message : String(err)
    }\n`
  );
  process.exit(1);
});