import { prefixBlock } from "../config.js";

export interface ObservationFilter {
  dimension: string;
  value: string;
  operator: "=" | "!=" | "<" | ">" | "<=" | ">=";
}

export interface QueryObservationsParams {
  cubeUri: string;
  dimensions: string[];
  measures: string[];
  filters: ObservationFilter[];
  limit: number;
  offset: number;
  language: string;
}

function escapeSparqlLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function escapeUri(uri: string): string {
  if (/[<>]/.test(uri)) {
    throw new Error(`URI contains illegal characters: ${uri}`);
  }
  return uri;
}

function isIri(value: string): boolean {
  return value.startsWith("http");
}

function shortName(uri: string): string {
  const match = uri.match(/[/#]([^/#]+)$/);
  return match ? match[1] : uri;
}

export function buildListCubesQuery(
  limit: number,
  offset: number
): string {
  return `${prefixBlock()}
SELECT ?cube ?title ?description ?dateModified ?publisher ?status WHERE {
  ?cube a cube:Cube .
  OPTIONAL { ?cube schema:name ?title . FILTER(LANG(?title) = "de") }
  OPTIONAL { ?cube schema:description ?description . FILTER(LANG(?description) = "de") }
  OPTIONAL { ?cube schema:dateModified ?dateModified . }
  OPTIONAL { ?cube schema:publisher ?publisher . }
  OPTIONAL { ?cube schema:creativeWorkStatus ?status . }
}
ORDER BY ?title
LIMIT ${limit} OFFSET ${offset}`;
}

export function buildCubeStructureQuery(cubeUri: string): string {
  const safeUri = escapeUri(cubeUri);
  return `${prefixBlock()}
SELECT ?path ?name ?datatype ?minCount ?maxCount ?order ?hasNode ?hasIn ?nodeKind WHERE {
  <${safeUri}> cube:observationConstraint ?shape .
  ?shape sh:property ?prop .
  ?prop sh:path ?path .
  OPTIONAL { ?prop schema:name ?name . FILTER(LANG(?name) = "de") }
  OPTIONAL { ?prop sh:datatype ?datatype . }
  OPTIONAL { ?prop sh:minCount ?minCount . }
  OPTIONAL { ?prop sh:maxCount ?maxCount . }
  OPTIONAL { ?prop sh:order ?order . }
  OPTIONAL { ?prop sh:node ?hasNode . }
  OPTIONAL { ?prop sh:in ?hasIn . }
  OPTIONAL { ?prop sh:nodeKind ?nodeKind . }
}
ORDER BY ?order`;
}

export function buildDimensionValuesQuery(
  cubeUri: string,
  dimensionPath: string,
  limit: number,
  language: string
): string {
  const safeUri = escapeUri(cubeUri);
  const safePath = escapeUri(dimensionPath);
  return `${prefixBlock()}
SELECT DISTINCT ?value ?label WHERE {
  <${safeUri}> cube:observationSet ?obsSet .
  ?obsSet cube:observation ?obs .
  ?obs <${safePath}> ?value .
  OPTIONAL {
    ?value schema:name ?valueLabel .
    FILTER(LANG(?valueLabel) = "${escapeSparqlLiteral(language)}")
  }
  BIND(COALESCE(?valueLabel, ?value) AS ?label)
}
LIMIT ${limit}`;
}

export function buildQueryObservationsQuery(
  params: QueryObservationsParams
): string {
  const safeUri = escapeUri(params.cubeUri);
  const pathToVar = new Map<string, string>();
  const selectVars: string[] = [];
  const patterns: string[] = [
    `<${safeUri}> cube:observationSet ?obsSet .`,
    `?obsSet cube:observation ?obs .`,
  ];

  params.dimensions.forEach((dim, i) => {
    const safePath = escapeUri(dim);
    const valueVar = `?dim_${i}`;
    const labelVar = `?dim_${i}_label`;
    pathToVar.set(dim, valueVar);
    selectVars.push(valueVar, labelVar);
    patterns.push(
      `OPTIONAL { ?obs <${safePath}> ${valueVar} . }`
    );
    patterns.push(
      `OPTIONAL { ${valueVar} schema:name ${labelVar} . FILTER(LANG(${labelVar}) = "${escapeSparqlLiteral(params.language)}") }`
    );
  });

  params.measures.forEach((mea, i) => {
    const safePath = escapeUri(mea);
    const valueVar = `?mea_${i}`;
    pathToVar.set(mea, valueVar);
    selectVars.push(valueVar);
    patterns.push(
      `OPTIONAL { ?obs <${safePath}> ${valueVar} . }`
    );
  });

  params.filters.forEach((filter, i) => {
    const safePath = escapeUri(filter.dimension);
    let filterVar = pathToVar.get(filter.dimension);
    if (!filterVar) {
      filterVar = `?filter_${i}`;
      patterns.push(`?obs <${safePath}> ${filterVar} .`);
    }
    const safeValue = isIri(filter.value)
      ? `<${escapeUri(filter.value)}>`
      : `"${escapeSparqlLiteral(filter.value)}"`;
    patterns.push(
      `FILTER(${filterVar} ${filter.operator} ${safeValue})`
    );
  });

  return `${prefixBlock()}
SELECT ${selectVars.join(" ")} WHERE {
  ${patterns.join("\n  ")}
}
LIMIT ${params.limit} OFFSET ${params.offset}`;
}

export function buildCountObservationsQuery(
  cubeUri: string,
  filters: ObservationFilter[]
): string {
  const safeUri = escapeUri(cubeUri);
  const pathToVar = new Map<string, string>();
  const patterns: string[] = [
    `<${safeUri}> cube:observationSet ?obsSet .`,
    `?obsSet cube:observation ?obs .`,
  ];

  filters.forEach((filter, i) => {
    const safePath = escapeUri(filter.dimension);
    let filterVar = pathToVar.get(filter.dimension);
    if (!filterVar) {
      filterVar = `?filter_${i}`;
      pathToVar.set(filter.dimension, filterVar);
      patterns.push(`?obs <${safePath}> ${filterVar} .`);
    }
    const safeValue = isIri(filter.value)
      ? `<${escapeUri(filter.value)}>`
      : `"${escapeSparqlLiteral(filter.value)}"`;
    patterns.push(
      `FILTER(${filterVar} ${filter.operator} ${safeValue})`
    );
  });

  return `${prefixBlock()}
SELECT (COUNT(?obs) AS ?count) WHERE {
  ${patterns.join("\n  ")}
}`;
}

export function buildGetCantonsQuery(language: string): string {
  return `${prefixBlock()}
SELECT ?canton ?name WHERE {
  ?canton a <https://schema.ld.admin.ch/Canton> .
  ?canton schema:name ?name .
  FILTER(LANG(?name) = "${escapeSparqlLiteral(language)}")
}
ORDER BY ?name`;
}

export function buildResolveGeographyQuery(
  name: string,
  language: string
): string {
  const escapedName = escapeSparqlLiteral(name);
  const escapedLang = escapeSparqlLiteral(language);
  return `${prefixBlock()}
SELECT ?iri ?name ?type WHERE {
  ?iri schema:name ?name .
  ?iri a ?type .
  FILTER(LANG(?name) = "${escapedLang}")
  FILTER(CONTAINS(LCASE(?name), LCASE("${escapedName}")))
  FILTER(?type IN (<https://schema.ld.admin.ch/Canton>, <https://schema.ld.admin.ch/Municipality>, <https://schema.ld.admin.ch/District>))
}
LIMIT 20`;
}

export function buildSearchDatasetsQuery(
  queryText: string,
  limit: number
): string {
  const escaped = escapeSparqlLiteral(queryText);
  return `${prefixBlock()}
SELECT ?cube ?title ?description WHERE {
  ?cube a cube:Cube .
  OPTIONAL { ?cube schema:name ?title . FILTER(LANG(?title) = "de") }
  OPTIONAL { ?cube schema:description ?description . FILTER(LANG(?description) = "de") }
  FILTER(
    (BOUND(?title) && CONTAINS(LCASE(?title), LCASE("${escaped}")))
    || (BOUND(?description) && CONTAINS(LCASE(?description), LCASE("${escaped}")))
  )
}
LIMIT ${limit}`;
}

export { shortName, escapeSparqlLiteral, escapeUri };