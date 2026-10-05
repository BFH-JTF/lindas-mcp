import { CONFIG } from "../config.js";
import { buildResolveIriQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery, SparqlError } from "../sparql/client.js";
import { parseResolveIri } from "../sparql/resultParser.js";

export const resolveIriToolDef = {
  name: "resolve_iri",
  description:
    "Look up a LINDAS IRI to get its human-readable label and type. Use this when query_observations returns opaque IRIs (e.g., https://ld.admin.ch/canton/1) and you need to explain what they mean.",
  inputSchema: {
    type: "object" as const,
    properties: {
      iri: {
        type: "string",
        description: "The LINDAS IRI to resolve (e.g., 'https://ld.admin.ch/canton/1')",
      },
      language: {
        type: "string",
        default: "de",
        enum: ["de", "fr", "it", "en"],
      },
    },
    required: ["iri"],
  },
};

export async function handleResolveIri(args: any): Promise<string> {
  try {
    const iri = args?.iri;
    if (!iri) {
      return JSON.stringify({ error: true, message: "Missing required parameter: iri" });
    }
    if (!iri.startsWith("http")) {
      return JSON.stringify({ error: true, message: "iri must be a valid URI starting with http" });
    }
    const language = args?.language ?? CONFIG.defaultLanguage;

    process.stderr.write(`[LINDAS-MCP] INFO  resolve_iri iri=${iri} lang=${language}\n`);

    const result = await executeSparqlQuery(buildResolveIriQuery(iri, language));
    const info = parseResolveIri(result, iri);

    if (!info.label && info.types.length === 0) {
      return JSON.stringify({ iri, label: null, types: [], note: "IRI not found or has no label in the requested language" });
    }

    return JSON.stringify(info, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error instanceof Error ? error.message : "Unknown error",
      query: error instanceof SparqlError ? error.query : undefined,
    });
  }
}