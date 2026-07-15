import { CONFIG, LINDAS_VOCAB } from "../config.js";
import {
  buildListCubesQuery,
} from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCubes } from "../sparql/resultParser.js";

export const listCubesToolDef = {
  name: "list_cubes",
  description:
    "List available data cubes on LINDAS with their titles and descriptions. Use this to discover what datasets are available. Call get_cube_structure next to understand a cube's dimensions.",
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: { type: "integer", default: 20, minimum: 1, maximum: 100 },
      offset: { type: "integer", default: 0, minimum: 0 },
      language: { type: "string", default: "de", enum: ["de", "fr", "it", "en"] },
      status: {
        type: "string",
        default: "Published",
        enum: ["Published", "Draft", "all"],
        description: "Filter by publication status: 'Published' (default), 'Draft', or 'all' to include everything",
      },
    },
  },
};

export async function handleListCubes(args: any): Promise<string> {
  try {
    const limit = Math.min(
      Math.max(args?.limit ?? 20, 1),
      CONFIG.maxResultLimit
    );
    const offset = Math.max(args?.offset ?? 0, 0);
    const language = args?.language ?? CONFIG.defaultLanguage;
    const statusParam = args?.status ?? "Published";
    const statusFilter = statusParam === "all" ? undefined : LINDAS_VOCAB[`status${statusParam}` as keyof typeof LINDAS_VOCAB] ?? undefined;

    process.stderr.write(
      `[LINDAS-MCP] INFO  list_cubes limit=${limit} offset=${offset} lang=${language} status=${statusParam}\n`
    );

    const start = Date.now();
    const result = await executeSparqlQuery(
      buildListCubesQuery(limit, offset, language, statusFilter)
    );
    const elapsed = Date.now() - start;
    const cubes = parseCubes(result);

    process.stderr.write(
      `[LINDAS-MCP] INFO  SPARQL query returned ${cubes.length} results in ${elapsed}ms\n`
    );

    return JSON.stringify(cubes, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}