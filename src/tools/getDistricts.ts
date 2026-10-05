import { CONFIG } from "../config.js";
import { buildGetDistrictsQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseDistricts } from "../sparql/resultParser.js";

export const getDistrictsToolDef = {
  name: "get_districts",
  description:
    "List Swiss districts with their LINDAS IRIs and names. Optionally filter by canton. Use the returned IRIs to filter observations by district in query_observations.",
  inputSchema: {
    type: "object" as const,
    properties: {
      canton_iri: {
        type: "string",
        description: "Optional canton IRI to filter districts (e.g., 'https://ld.admin.ch/canton/1')",
      },
      language: { type: "string", default: "de", enum: ["de", "fr", "it", "en"] },
    },
  },
};

export async function handleGetDistricts(args: any): Promise<string> {
  try {
    const language = args?.language ?? CONFIG.defaultLanguage;
    const cantonIri = args?.canton_iri;

    process.stderr.write(`[LINDAS-MCP] INFO  get_districts canton=${cantonIri ?? "all"} lang=${language}\n`);

    const result = await executeSparqlQuery(buildGetDistrictsQuery(language, cantonIri));
    return JSON.stringify(parseDistricts(result), null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}