import { CONFIG } from "../config.js";
import { buildResolveGeographyQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseGeographyResults } from "../sparql/resultParser.js";

export const resolveGeographyToolDef = {
  name: "resolve_geography",
  description:
    "Resolve a place name to its LINDAS IRI. Works for cantons, municipalities, and districts. Use this when a user mentions a Swiss place name and you need its IRI to filter cube observations.",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description:
          "Place name to search for (e.g., 'Zürich', 'Ticino', 'Bern')",
      },
      language: {
        type: "string",
        default: "de",
        enum: ["de", "fr", "it", "en"],
      },
    },
    required: ["name"],
  },
};

export async function handleResolveGeography(args: any): Promise<string> {
  try {
    const name = args?.name;
    if (!name) {
      return JSON.stringify({
        error: true,
        message: "Missing required parameter: name",
      });
    }
    const language = args?.language ?? CONFIG.defaultLanguage;

    process.stderr.write(
      `[LINDAS-MCP] INFO  resolve_geography name=${name} lang=${language}\n`
    );

    const result = await executeSparqlQuery(
      buildResolveGeographyQuery(name, language)
    );
    return JSON.stringify(parseGeographyResults(result), null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}