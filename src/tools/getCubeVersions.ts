import { buildCubeVersionsQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCubeVersions } from "../sparql/resultParser.js";

export const getCubeVersionsToolDef = {
  name: "get_cube_versions",
  description:
    "List all versions of a data cube. LINDAS cubes can have multiple versions (e.g., /1, /2, /3). Use this to discover what versions exist and select one other than the latest.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: { type: "string", description: "The URI of the cube (any version)" },
    },
    required: ["cube_uri"],
  },
};

export async function handleGetCubeVersions(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    if (!cubeUri) {
      return JSON.stringify({ error: true, message: "Missing required parameter: cube_uri" });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({ error: true, message: "cube_uri must be a valid URI starting with http" });
    }

    process.stderr.write(`[LINDAS-MCP] INFO  get_cube_versions cube=${cubeUri}\n`);

    const result = await executeSparqlQuery(buildCubeVersionsQuery(cubeUri));
    const versions = parseCubeVersions(result);

    return JSON.stringify({ cube_uri: cubeUri, versions }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}