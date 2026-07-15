import { CONFIG } from "../config.js";
import { buildGetCantonsQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCantons } from "../sparql/resultParser.js";

export const getCantonsToolDef = {
  name: "get_cantons",
  description:
    "List all 26 Swiss cantons with their LINDAS IRIs and names. Use the returned IRIs to filter observations by canton in query_observations.",
  inputSchema: {
    type: "object" as const,
    properties: {
      language: {
        type: "string",
        default: "de",
        enum: ["de", "fr", "it", "en"],
      },
    },
  },
};

export async function handleGetCantons(args: any): Promise<string> {
  try {
    const language = args?.language ?? CONFIG.defaultLanguage;

    process.stderr.write(
      `[LINDAS-MCP] INFO  get_cantons lang=${language}\n`
    );

    const result = await executeSparqlQuery(buildGetCantonsQuery(language));
    return JSON.stringify(parseCantons(result), null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}