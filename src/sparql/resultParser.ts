import type { SparqlBinding, SparqlResult } from "./client.js";
import { shortName } from "./queryBuilder.js";

export function parseBindingValue(
  binding: SparqlBinding,
  key: string
): string | undefined {
  return binding[key]?.value;
}

export interface CubeInfo {
  uri: string;
  title: string;
  description: string;
  dateModified: string;
  status?: string;
}

export function parseCubes(result: SparqlResult): CubeInfo[] {
  return result.results.bindings.map((b) => ({
    uri: parseBindingValue(b, "cube") ?? "",
    title: parseBindingValue(b, "title") ?? "",
    description: parseBindingValue(b, "description") ?? "",
    dateModified: parseBindingValue(b, "dateModified") ?? "",
    status: parseBindingValue(b, "status"),
  }));
}

export interface CubeProperty {
  path: string;
  name: string;
  datatype: string;
  minCount: string;
  maxCount: string;
  order: string;
  hasNestedShape: boolean;
}

export function parseCubeStructure(result: SparqlResult): CubeProperty[] {
  return result.results.bindings.map((b) => {
    const hasNode = parseBindingValue(b, "hasNode");
    const hasIn = parseBindingValue(b, "hasIn");
    const nodeKind = parseBindingValue(b, "nodeKind");
    const datatype = parseBindingValue(b, "datatype") ?? "";
    const hasNestedShape = Boolean(
      hasNode || hasIn || nodeKind === "http://www.w3.org/ns/shacl#IRI" || !datatype
    );
    return {
      path: parseBindingValue(b, "path") ?? "",
      name: parseBindingValue(b, "name") ?? "",
      datatype,
      minCount: parseBindingValue(b, "minCount") ?? "",
      maxCount: parseBindingValue(b, "maxCount") ?? "",
      order: parseBindingValue(b, "order") ?? "",
      hasNestedShape,
    };
  });
}

export interface DimensionValue {
  value: string;
  label: string;
}

export function parseDimensionValues(
  result: SparqlResult
): DimensionValue[] {
  return result.results.bindings.map((b) => ({
    value: parseBindingValue(b, "value") ?? "",
    label: parseBindingValue(b, "label") ?? parseBindingValue(b, "value") ?? "",
  }));
}

export interface ObservationResult {
  [propertyShortName: string]: {
    value: string;
    label: string;
  };
}

export function parseObservations(
  result: SparqlResult,
  dimensions: string[],
  measures: string[]
): ObservationResult[] {
  const allPaths = [...dimensions, ...measures];
  return result.results.bindings.map((b) => {
    const obs: ObservationResult = {};
    dimensions.forEach((path, i) => {
      const valueVar = `dim_${i}`;
      const labelVar = `dim_${i}_label`;
      const value = parseBindingValue(b, valueVar);
      if (value !== undefined) {
        const label = parseBindingValue(b, labelVar) ?? value;
        obs[shortName(path)] = { value, label };
      }
    });
    measures.forEach((path, i) => {
      const valueVar = `mea_${i}`;
      const value = parseBindingValue(b, valueVar);
      if (value !== undefined) {
        obs[shortName(path)] = { value, label: value };
      }
    });
    return obs;
  });
}

export function parseCount(result: SparqlResult): number {
  const binding = result.results.bindings[0];
  if (!binding) return 0;
  const value = parseBindingValue(binding, "count");
  return value ? parseInt(value, 10) : 0;
}

export interface CantonInfo {
  iri: string;
  name: string;
}

export function parseCantons(result: SparqlResult): CantonInfo[] {
  return result.results.bindings.map((b) => ({
    iri: parseBindingValue(b, "canton") ?? "",
    name: parseBindingValue(b, "name") ?? "",
  }));
}

export interface GeographyResult {
  iri: string;
  name: string;
  type: string;
}

function shortTypeName(typeUri: string): string {
  const match = typeUri.match(/[/#]([^/#]+)$/);
  return match ? match[1] : typeUri;
}

export function parseGeographyResults(
  result: SparqlResult
): GeographyResult[] {
  return result.results.bindings.map((b) => ({
    iri: parseBindingValue(b, "iri") ?? "",
    name: parseBindingValue(b, "name") ?? "",
    type: shortTypeName(parseBindingValue(b, "type") ?? ""),
  }));
}

export interface SearchResult {
  uri: string;
  title: string;
  description: string;
}

export function parseSearchResults(
  result: SparqlResult
): SearchResult[] {
  return result.results.bindings.map((b) => ({
    uri: parseBindingValue(b, "cube") ?? "",
    title: parseBindingValue(b, "title") ?? "",
    description: parseBindingValue(b, "description") ?? "",
  }));
}