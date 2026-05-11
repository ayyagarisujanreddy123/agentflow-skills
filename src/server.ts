import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { ConfigManager } from "./config.js";
import { TokenLedger } from "./ledger.js";
import { AnthropicClient } from "./client.js";
import { allTools } from "./tools/index.js";
import { ToolContext } from "./tools/types.js";

export async function runServer(): Promise<void> {
  const config = new ConfigManager();
  config.watch();

  const client = new AnthropicClient(config.getApiKey());
  config.onChange(c => client.setApiKey(c.api_key ?? process.env.ANTHROPIC_API_KEY));

  const ledger = new TokenLedger(config.getLogDir());
  const ctx: ToolContext = { client, config, ledger };

  const server = new Server(
    { name: "agentflow", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const tool = allTools.find(t => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true
      };
    }
    try {
      const result = await tool.handler(req.params.arguments ?? {}, ctx);
      return {
        content: [{ type: "text", text: result.text }],
        isError: !!result.isError
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Tool ${name} crashed: ${e?.message ?? String(e)}` }],
        isError: true
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = () => {
    try { config.stop(); } catch { /* ignore */ }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
