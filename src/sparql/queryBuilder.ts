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

function isNumeric(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value);
}

function formatFilterPattern(filterVar: string, filter: ObservationFilter): string {
  if (isIri(filter.value)) {
    return `FILTER(${filterVar} ${filter.operator} <${escapeUri(filter.value)}>)`;
  }
  if (isNumeric(filter.value)) {
    const escaped = escapeSparqlLiteral(filter.value);
    if (filter.operator === "=" || filter.operator === "!=") {
      return `FILTER(STR(${filterVar}) ${filter.operator} "${escaped}")`;
    }
    return `FILTER(xsd:integer(STR(${filterVar})) ${filter.operator} ${escaped})`;
  }
  return `FILTER(${filterVar} ${filter.operator} "${escapeSparqlLiteral(filter.value)}")`;
}

function shortName(uri: string): string {
  const match = uri.match(/[/#]([^/#]+)$/);
  return match ? match[1] : uri;
}

export function buildListCubesQuery(
  limit: number,
  offset: number,
  language: string = "de",
  status?: string
): string {
  const escapedLang = escapeSparqlLiteral(language);
  const statusFilter = status
    ? `\n  ?cube schema:creativeWorkStatus <${escapeUri(status)}> .`
    : "";
  return `${prefixBlock()}
SELECT ?cube ?title ?description ?dateModified ?publisher ?status WHERE {
  ?cube a cube:Cube .${statusFilter}
  OPTIONAL { ?cube schema:name ?title . FILTER(LANG(?title) = "${escapedLang}") }
  OPTIONAL { ?cube schema:description ?description . FILTER(LANG(?description) = "${escapedLang}") }
  OPTIONAL { ?cube schema:dateModified ?dateModified . }
  OPTIONAL { ?cube schema:publisher ?publisher . }
  OPTIONAL { ?cube schema:creativeWorkStatus ?status . }
}
ORDER BY ?title
LIMIT ${limit} OFFSET ${offset}`;
}

export function buildCubeStructureQuery(cubeUri: string, language: string = "de"): string {
  const safeUri = escapeUri(cubeUri);
  const escapedLang = escapeSparqlLiteral(language);
  return `${prefixBlock()}
SELECT ?path ?name ?datatype ?minCount ?maxCount ?order ?hasNode ?hasIn ?nodeKind WHERE {
  <${safeUri}> cube:observationConstraint ?shape .
  ?shape sh:property ?prop .
  ?prop sh:path ?path .
  OPTIONAL { ?prop schema:name ?name . FILTER(LANG(?name) = "${escapedLang}") }
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
    patterns.push(formatFilterPattern(filterVar, filter));
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
    patterns.push(formatFilterPattern(filterVar, filter));
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
  limit: number,
  language: string = "de",
  status?: string
): string {
  const escaped = escapeSparqlLiteral(queryText);
  const escapedLang = escapeSparqlLiteral(language);
  const statusFilter = status
    ? `\n  ?cube schema:creativeWorkStatus <${escapeUri(status)}> .`
    : "";
  return `${prefixBlock()}
SELECT ?cube ?title ?description WHERE {
  ?cube a cube:Cube .${statusFilter}
  OPTIONAL { ?cube schema:name ?title . FILTER(LANG(?title) = "${escapedLang}") }
  OPTIONAL { ?cube schema:description ?description . FILTER(LANG(?description) = "${escapedLang}") }
  FILTER(
    (BOUND(?title) && CONTAINS(LCASE(?title), LCASE("${escaped}")))
    || (BOUND(?description) && CONTAINS(LCASE(?description), LCASE("${escaped}")))
  )
}
LIMIT ${limit}`;
}

export function buildResolveIriQuery(
  iri: string,
  language: string
): string {
  const safeIri = escapeUri(iri);
  const escapedLang = escapeSparqlLiteral(language);
  return `${prefixBlock()}
SELECT ?label ?type WHERE {
  <${safeIri}> schema:name ?label .
  FILTER(LANG(?label) = "${escapedLang}")
  OPTIONAL { <${safeIri}> a ?type . }
}
LIMIT 1`;
}

export function buildDimensionSummaryQuery(
  cubeUri: string,
  language: string
): string {
  const safeUri = escapeUri(cubeUri);
  const escapedLang = escapeSparqlLiteral(language);
  return `${prefixBlock()}
SELECT ?path ?name ?datatype ?valueCount ?hasNode ?hasIn ?nodeKind WHERE {
  <${safeUri}> cube:observationConstraint ?shape .
  ?shape sh:property ?prop .
  ?prop sh:path ?path .
  OPTIONAL { ?prop schema:name ?name . FILTER(LANG(?name) = "${escapedLang}") }
  OPTIONAL { ?prop sh:datatype ?datatype . }
  OPTIONAL { ?prop sh:node ?hasNode . }
  OPTIONAL { ?prop sh:in ?hasIn . }
  OPTIONAL { ?prop sh:nodeKind ?nodeKind . }
  OPTIONAL {
    SELECT ?path (COUNT(DISTINCT ?val) AS ?valueCount) WHERE {
      <${safeUri}> cube:observationSet ?obsSet .
      ?obsSet cube:observation ?obs .
      ?obs ?path ?val .
    }
    GROUP BY ?path
  }
}
ORDER BY ?path`;
}

export function buildGetMunicipalitiesQuery(
  language: string,
  cantonIri?: string
): string {
  const escapedLang = escapeSparqlLiteral(language);
  let cantonFilter = "";
  if (cantonIri) {
    cantonFilter = `\n  ?municipality <https://schema.ld.admin.ch/canton> <${escapeUri(cantonIri)}> .`;
  }
  return `${prefixBlock()}
SELECT ?municipality ?name WHERE {
  ?municipality a <https://schema.ld.admin.ch/Municipality> .${cantonFilter}
  ?municipality schema:name ?name .
  FILTER(LANG(?name) = "${escapedLang}")
}
ORDER BY ?name`;
}

export function buildGetDistrictsQuery(
  language: string,
  cantonIri?: string
): string {
  const escapedLang = escapeSparqlLiteral(language);
  let cantonFilter = "";
  if (cantonIri) {
    cantonFilter = `\n  ?district <https://schema.ld.admin.ch/canton> <${escapeUri(cantonIri)}> .`;
  }
  return `${prefixBlock()}
SELECT ?district ?name WHERE {
  ?district a <https://schema.ld.admin.ch/District> .${cantonFilter}
  ?district schema:name ?name .
  FILTER(LANG(?name) = "${escapedLang}")
}
ORDER BY ?name`;
}

export function buildCubeMetadataQuery(cubeUri: string): string {
  const safeUri = escapeUri(cubeUri);
  return `${prefixBlock()}
SELECT ?title ?description ?publisher ?license ?status ?dateCreated ?dateModified ?datePublished WHERE {
  <${safeUri}> a cube:Cube .
  OPTIONAL { <${safeUri}> schema:name ?title . FILTER(LANG(?title) = "de") }
  OPTIONAL { <${safeUri}> schema:description ?description . FILTER(LANG(?description) = "de") }
  OPTIONAL { <${safeUri}> schema:publisher ?publisher . }
  OPTIONAL { <${safeUri}> schema:license ?license . }
  OPTIONAL { <${safeUri}> schema:creativeWorkStatus ?status . }
  OPTIONAL { <${safeUri}> schema:dateCreated ?dateCreated . }
  OPTIONAL { <${safeUri}> schema:dateModified ?dateModified . }
  OPTIONAL { <${safeUri}> schema:datePublished ?datePublished . }
}
LIMIT 1`;
}

export function buildCubeVersionsQuery(cubeUri: string): string {
  const safeUri = escapeUri(cubeUri);
  const baseUri = safeUri.replace(/\/\d+\/?$/, "");
  return `${prefixBlock()}
SELECT ?version ?dateModified ?status WHERE {
  ?version a cube:Cube .
  FILTER(STRSTARTS(STR(?version), "${baseUri}"))
  OPTIONAL { ?version schema:dateModified ?dateModified . }
  OPTIONAL { ?version schema:creativeWorkStatus ?status . }
}
ORDER BY ?version`;
}

export function buildCountByDimensionQuery(
  cubeUri: string,
  dimension: string,
  filters: ObservationFilter[],
  limit: number,
  language: string
): string {
  const safeUri = escapeUri(cubeUri);
  const safeDim = escapeUri(dimension);
  const escapedLang = escapeSparqlLiteral(language);
  const pathToVar = new Map<string, string>();
  const patterns: string[] = [
    `<${safeUri}> cube:observationSet ?obsSet .`,
    `?obsSet cube:observation ?obs .`,
    `?obs <${safeDim}> ?dimValue .`,
  ];
  patterns.push(
    `OPTIONAL { ?dimValue schema:name ?dimLabel . FILTER(LANG(?dimLabel) = "${escapedLang}") }`
  );

  filters.forEach((filter, i) => {
    const safePath = escapeUri(filter.dimension);
    let filterVar = pathToVar.get(filter.dimension);
    if (!filterVar) {
      filterVar = `?filter_${i}`;
      pathToVar.set(filter.dimension, filterVar);
      patterns.push(`?obs <${safePath}> ${filterVar} .`);
    }
    patterns.push(formatFilterPattern(filterVar, filter));
  });

  return `${prefixBlock()}
SELECT ?dimValue ?dimLabel (COUNT(?obs) AS ?count) WHERE {
  ${patterns.join("\n  ")}
}
GROUP BY ?dimValue ?dimLabel
ORDER BY DESC(?count)
LIMIT ${limit}`;
}

export { shortName, escapeSparqlLiteral, escapeUri };