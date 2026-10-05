import { CONFIG } from "../config.js";
import { buildGetMunicipalitiesQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseMunicipalities } from "../sparql/resultParser.js";

export const getMunicipalitiesToolDef = {
  name: "get_municipalities",
  description:
    "List Swiss municipalities with their LINDAS IRIs and names. Optionally filter by canton. Use the returned IRIs to filter observations by municipality in query_observations.",
  inputSchema: {
    type: "object" as const,
    properties: {
      canton_iri: {
        type: "string",
        description: "Optional canton IRI to filter municipalities (e.g., 'https://ld.admin.ch/canton/1')",
      },
      language: { type: "string", default: "de", enum: ["de", "fr", "it", "en"] },
    },
  },
};

export async function handleGetMunicipalities(args: any): Promise<string> {
  try {
    const language = args?.language ?? CONFIG.defaultLanguage;
    const cantonIri = args?.canton_iri;

    process.stderr.write(`[LINDAS-MCP] INFO  get_municipalities canton=${cantonIri ?? "all"} lang=${language}\n`);

    const result = await executeSparqlQuery(buildGetMunicipalitiesQuery(language, cantonIri));
    return JSON.stringify(parseMunicipalities(result), null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}