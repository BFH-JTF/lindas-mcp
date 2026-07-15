import { CONFIG } from "../config.js";
import { buildSearchDatasetsQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseSearchResults } from "../sparql/resultParser.js";

export const searchDatasetsToolDef = {
  name: "search_datasets",
  description:
    "Full-text search across LINDAS cubes by title and description. Use this when looking for datasets about a specific topic (e.g., 'population', 'forest', 'unemployment').",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string", description: "Text to search for" },
      limit: { type: "integer", default: 20, minimum: 1, maximum: 50 },
    },
    required: ["query"],
  },
};

export async function handleSearchDatasets(args: any): Promise<string> {
  try {
    const queryText = args?.query;
    if (!queryText) {
      return JSON.stringify({
        error: true,
        message: "Missing required parameter: query",
      });
    }

    const limit = Math.min(
      Math.max(args?.limit ?? 20, 1),
      CONFIG.maxResultLimit
    );

    process.stderr.write(
      `[LINDAS-MCP] INFO  search_datasets query="${queryText}" limit=${limit}\n`
    );

    const start = Date.now();
    const result = await executeSparqlQuery(
      buildSearchDatasetsQuery(queryText, limit)
    );
    const elapsed = Date.now() - start;
    const results = parseSearchResults(result);

    process.stderr.write(
      `[LINDAS-MCP] INFO  search returned ${results.length} results in ${elapsed}ms\n`
    );

    return JSON.stringify(results, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}