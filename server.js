
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const transports = new Map();

function createMcpServer() {
  const server = new McpServer({
    name: "ai-video-studio",
    version: "1.0.0"
  });

  server.registerTool(
    "test_connection",
    {
      description: "Test koneksi MCP Server",
      inputSchema: {}
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "Koneksi AI Video Studio berhasil!"
        }
      ]
    })
  );

  return server;
}

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (url.pathname !== "/mcp") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  let body;

  if (req.method === "POST") {
    try {
      let rawBody = "";
      for await (const chunk of req) {
        rawBody += chunk;
      }
      body = JSON.parse(rawBody);
    } catch {
      res.writeHead(400);
      res.end("Invalid JSON");
      return;
    }
  }

  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId
    ? transports.get(sessionId)
    : undefined;

  if (
    !transport &&
    req.method === "POST" &&
    isInitializeRequest(body)
  ) {
    let newTransport;

    newTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, newTransport);
      },
      onsessionclosed: (id) => {
        transports.delete(id);
      }
    });

    await createMcpServer().connect(newTransport);
    transport = newTransport;
  }

  if (!transport) {
    res.writeHead(400);
    res.end("Invalid or missing MCP session");
    return;
  }

  await transport.handleRequest(req, res, body);
});

const PORT = process.env.PORT || 10000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`AI Video Studio MCP running on port ${PORT}`);
});
