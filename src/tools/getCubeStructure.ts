import { buildCubeStructureQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseCubeStructure } from "../sparql/resultParser.js";

export const getCubeStructureToolDef = {
  name: "get_cube_structure",
  description:
    "Get the structure of a specific data cube: its dimensions, measures, datatypes, and constraints. ALWAYS call this before query_observations to understand what dimensions and measures are available. The 'path' field in the result is the property URI you pass to query_observations, get_dimension_values, and as filter dimensions.",
  inputSchema: {
    type: "object" as const,
    properties: {
      cube_uri: {
        type: "string",
        description: "The URI of the cube (from list_cubes results)",
      },
    },
    required: ["cube_uri"],
  },
};

export async function handleGetCubeStructure(args: any): Promise<string> {
  try {
    const cubeUri = args?.cube_uri;
    if (!cubeUri) {
      return JSON.stringify({
        error: true,
        message: "Missing required parameter: cube_uri",
      });
    }
    if (!cubeUri.startsWith("http")) {
      return JSON.stringify({
        error: true,
        message: "cube_uri must be a valid URI starting with http",
      });
    }

    process.stderr.write(
      `[LINDAS-MCP] INFO  get_cube_structure cube_uri=${cubeUri}\n`
    );

    const result = await executeSparqlQuery(buildCubeStructureQuery(cubeUri));
    const properties = parseCubeStructure(result);

    return JSON.stringify(
      {
        cube_uri: cubeUri,
        properties,
        hint:
          "Properties with hasNestedShape=true are IRI-valued dimensions (use get_dimension_values to see options). Properties with numeric datatypes (xsd:integer, xsd:decimal, xsd:double) are measures. Use the 'path' value as the dimension/measure argument in query_observations.",
      },
      null,
      2
    );
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}