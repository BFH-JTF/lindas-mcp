import { CONFIG } from "../config.js";
import { buildDimensionSummaryQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseDimensionSummary } from "../sparql/resultParser.js";

export const getDimensionSummaryToolDef = {
  name: "get_dimension_summary",
  description:
    "Get all dimensions of a cube with value counts and ranges in a single call. Replaces calling get_dimension_values for each dimension separately when you just need an overview. Use after get_cube_structure to understand dimension cardinality.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string", description: "The URI of the cube" },
      language: { type: "string", default: "de", enum: ["de", "fr", "it", "en"] },
    },
    required: ["cube_uri"],
  },
};

export async function handleGetDimensionSummary(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    if (!cubeUri) {
      return JSON.stringify({ error: true, message: "Missing required parameter: cube_uri" });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({ error: true, message: "cube_uri must be a valid URI starting with http" });
    }
    const language = args?.language ?? CONFIG.defaultLanguage;

    process.stderr.write(`[LINDAS-MCP] INFO  get_dimension_summary cube=${cubeUri} lang=${language}\n`);

    const start = Date.now();
    const result = await executeSparqlQuery(buildDimensionSummaryQuery(cubeUri, language));
    const elapsed = Date.now() - start;
    const summary = parseDimensionSummary(result);

    process.stderr.write(`[LINDAS-MCP] INFO  dimension summary returned ${summary.length} dimensions in ${elapsed}ms\n`);

    return JSON.stringify({ cube_uri: cubeUri, dimensions: summary }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}