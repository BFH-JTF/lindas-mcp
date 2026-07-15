import { CONFIG } from "../config.js";
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

    process.stderr.write(
      `[LINDAS-MCP] INFO  list_cubes limit=${limit} offset=${offset}\n`
    );

    const start = Date.now();
    const result = await executeSparqlQuery(
      buildListCubesQuery(limit, offset)
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