export const CONFIG = {
  sparqlEndpoint:
    process.env.LINDAS_SPARQL_ENDPOINT ?? "https://ld.admin.ch/query",
  defaultLanguage: process.env.LINDAS_DEFAULT_LANGUAGE ?? "de",
  requestTimeoutMs: 30_000,
  maxResultLimit: 500,
  defaultResultLimit: 50,
} as const;

export const PREFIXES = {
  cube: "https://cube.link/",
  schema: "http://schema.org/",
  sh: "http://www.w3.org/ns/shacl#",
  dcterms: "http://purl.org/dc/terms/",
  xsd: "http://www.w3.org/2001/XMLSchema#",
} as const;

export const LINDAS_VOCAB = {
  canton: "https://schema.ld.admin.ch/Canton",
  municipality: "https://schema.ld.admin.ch/Municipality",
  district: "https://schema.ld.admin.ch/District",
  statusPublished: "https://ld.admin.ch/vocabulary/CreativeWorkStatus/Published",
  statusDraft: "https://ld.admin.ch/vocabulary/CreativeWorkStatus/Draft",
} as const;

export function prefixBlock(): string {
  return [
    `PREFIX cube: <${PREFIXES.cube}>`,
    `PREFIX schema: <${PREFIXES.schema}>`,
    `PREFIX sh: <${PREFIXES.sh}>`,
    `PREFIX dcterms: <${PREFIXES.dcterms}>`,
    `PREFIX xsd: <${PREFIXES.xsd}>`,
  ].join("\n");
}