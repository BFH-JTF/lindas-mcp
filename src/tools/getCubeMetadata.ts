import { buildCubeMetadataQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCubeMetadata } from "../sparql/resultParser.js";

export const getCubeMetadataToolDef = {
  name: "get_cube_metadata",
  description:
    "Get publisher, license, status, temporal coverage, and other metadata for a data cube. Provides context beyond what list_cubes and get_cube_structure offer.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string", description: "The URI of the cube" },
    },
    required: ["cube_uri"],
  },
};

export async function handleGetCubeMetadata(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    if (!cubeUri) {
      return JSON.stringify({ error: true, message: "Missing required parameter: cube_uri" });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({ error: true, message: "cube_uri must be a valid URI starting with http" });
    }

    process.stderr.write(`[LINDAS-MCP] INFO  get_cube_metadata cube=${cubeUri}\n`);

    const result = await executeSparqlQuery(buildCubeMetadataQuery(cubeUri));
    const metadata = parseCubeMetadata(result);

    return JSON.stringify({ cube_uri: cubeUri, ...metadata }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}