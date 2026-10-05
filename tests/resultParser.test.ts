import { describe, it, expect } from "vitest";
import {
  parseBindingValue,
  parseCubes,
  parseCubeStructure,
  parseDimensionValues,
  parseObservations,
  parseCount,
  parseCantons,
  parseGeographyResults,
  parseSearchResults,
  parseResolveIri,
  parseDimensionSummary,
  parseMunicipalities,
  parseDistricts,
  parseCubeMetadata,
  parseCubeVersions,
  parseCountByDimension,
} from "../src/sparql/resultParser.js";
import type { SparqlResult } from "../src/sparql/client.js";

function makeBinding(fields: Record<string, { value: string; type?: string; "xml:lang"?: string }>): any {
  return fields;
}

describe("parseBindingValue", () => {
  it("returns value for existing key", () => {
    const b = makeBinding({ foo: { value: "bar", type: "literal" } });
    expect(parseBindingValue(b, "foo")).toBe("bar");
  });

  it("returns undefined for missing key", () => {
    const b = makeBinding({});
    expect(parseBindingValue(b, "missing")).toBeUndefined();
  });
});

describe("parseCubes", () => {
  it("maps 3 bindings to 3 CubeInfo objects", () => {
    const result: SparqlResult = {
      head: { vars: ["cube", "title"] },
      results: {
        bindings: [
          makeBinding({
            cube: { value: "https://ld.admin.ch/cube/1", type: "uri" },
            title: { value: "Population", type: "literal", "xml:lang": "de" },
            description: { value: "Annual", type: "literal" },
            dateModified: { value: "2024-01-15", type: "literal" },
            status: { value: "Published", type: "uri" },
          }),
          makeBinding({
            cube: { value: "https://ld.admin.ch/cube/2", type: "uri" },
            title: { value: "Forest", type: "literal", "xml:lang": "de" },
            description: { value: "", type: "literal" },
            dateModified: { value: "2024-03-01", type: "literal" },
          }),
          makeBinding({
            cube: { value: "https://ld.admin.ch/cube/3", type: "uri" },
            title: { value: "Economy", type: "literal", "xml:lang": "de" },
          }),
        ],
      } as any,
    };

    const cubes = parseCubes(result);
    expect(cubes).toHaveLength(3);
    expect(cubes[0].uri).toBe("https://ld.admin.ch/cube/1");
    expect(cubes[0].title).toBe("Population");
    expect(cubes[0].status).toBe("Published");
    expect(cubes[1].status).toBeUndefined();
  });

  it("returns empty array for empty bindings", () => {
    const result: SparqlResult = {
      head: { vars: [] },
      results: { bindings: [] },
    };
    expect(parseCubes(result)).toEqual([]);
  });

  it("handles missing fields gracefully", () => {
    const result: SparqlResult = {
      head: { vars: ["cube"] },
      results: {
        bindings: [
          makeBinding({
            cube: { value: "https://ld.admin.ch/cube/1", type: "uri" },
          }),
        ],
      } as any,
    };
    const cubes = parseCubes(result);
    expect(cubes[0].uri).toBe("https://ld.admin.ch/cube/1");
    expect(cubes[0].title).toBe("");
    expect(cubes[0].description).toBe("");
  });
});

describe("parseCubeStructure", () => {
  it("detects hasNestedShape from sh:node", () => {
    const result: SparqlResult = {
      head: { vars: ["path"] },
      results: {
        bindings: [
          makeBinding({
            path: { value: "https://example.org/canton", type: "uri" },
            name: { value: "Canton", type: "literal" },
            hasNode: { value: "https://example.org/shape", type: "uri" },
          }),
        ],
      } as any,
    };
    const props = parseCubeStructure(result);
    expect(props[0].hasNestedShape).toBe(true);
  });

  it("detects hasNestedShape from sh:in", () => {
    const result: SparqlResult = {
      head: { vars: ["path"] },
      results: {
        bindings: [
          makeBinding({
            path: { value: "https://example.org/canton", type: "uri" },
            hasIn: { value: "https://example.org/list", type: "bnode" },
          }),
        ],
      } as any,
    };
    const props = parseCubeStructure(result);
    expect(props[0].hasNestedShape).toBe(true);
  });

  it("hasNestedShape false when datatype present and no IRI signal", () => {
    const result: SparqlResult = {
      head: { vars: ["path"] },
      results: {
        bindings: [
          makeBinding({
            path: { value: "https://example.org/year", type: "uri" },
            datatype: { value: "http://www.w3.org/2001/XMLSchema#gYear", type: "uri" },
          }),
        ],
      } as any,
    };
    const props = parseCubeStructure(result);
    expect(props[0].hasNestedShape).toBe(false);
  });
});

describe("parseDimensionValues", () => {
  it("returns value and label", () => {
    const result: SparqlResult = {
      head: { vars: ["value", "label"] },
      results: {
        bindings: [
          makeBinding({
            value: { value: "https://ld.admin.ch/canton/1", type: "uri" },
            label: { value: "Zürich", type: "literal" },
          }),
        ],
      } as any,
    };
    const vals = parseDimensionValues(result);
    expect(vals[0].value).toBe("https://ld.admin.ch/canton/1");
    expect(vals[0].label).toBe("Zürich");
  });

  it("falls back label to value when label missing", () => {
    const result: SparqlResult = {
      head: { vars: ["value"] },
      results: {
        bindings: [
          makeBinding({
            value: { value: "2023", type: "literal" },
          }),
        ],
      } as any,
    };
    const vals = parseDimensionValues(result);
    expect(vals[0].label).toBe("2023");
  });
});

describe("parseObservations", () => {
  it("maps bindings with short-name keys", () => {
    const result: SparqlResult = {
      head: { vars: ["dim_0", "dim_0_label", "mea_0"] },
      results: {
        bindings: [
          makeBinding({
            dim_0: { value: "https://ld.admin.ch/canton/1", type: "uri" },
            dim_0_label: { value: "Zürich", type: "literal" },
            mea_0: { value: "1520968", type: "literal" },
          }),
        ],
      } as any,
    };
    const obs = parseObservations(
      result,
      ["https://example.org/canton"],
      ["https://example.org/population"]
    );
    expect(obs[0].canton).toEqual({
      value: "https://ld.admin.ch/canton/1",
      label: "Zürich",
    });
    expect(obs[0].population).toEqual({
      value: "1520968",
      label: "1520968",
    });
  });

  it("handles missing OPTIONAL values gracefully", () => {
    const result: SparqlResult = {
      head: { vars: ["dim_0", "dim_0_label", "mea_0"] },
      results: {
        bindings: [
          makeBinding({
            mea_0: { value: "100", type: "literal" },
          }),
        ],
      } as any,
    };
    const obs = parseObservations(
      result,
      ["https://example.org/canton"],
      ["https://example.org/population"]
    );
    expect(obs[0].canton).toBeUndefined();
    expect(obs[0].population).toEqual({ value: "100", label: "100" });
  });

  it("returns empty array for no bindings", () => {
    const result: SparqlResult = {
      head: { vars: [] },
      results: { bindings: [] },
    };
    expect(parseObservations(result, [], [])).toEqual([]);
  });
});

describe("parseCount", () => {
  it("extracts numeric count", () => {
    const result: SparqlResult = {
      head: { vars: ["count"] },
      results: {
        bindings: [
          makeBinding({
            count: { value: "1520", type: "literal", datatype: "http://www.w3.org/2001/XMLSchema#integer" },
          }),
        ],
      } as any,
    };
    expect(parseCount(result)).toBe(1520);
  });

  it("returns 0 for empty results", () => {
    const result: SparqlResult = {
      head: { vars: ["count"] },
      results: { bindings: [] },
    };
    expect(parseCount(result)).toBe(0);
  });
});

describe("parseCantons", () => {
  it("maps to iri and name", () => {
    const result: SparqlResult = {
      head: { vars: ["canton", "name"] },
      results: {
        bindings: [
          makeBinding({
            canton: { value: "https://ld.admin.ch/canton/1", type: "uri" },
            name: { value: "Zürich", type: "literal", "xml:lang": "de" },
          }),
        ],
      } as any,
    };
    const cantons = parseCantons(result);
    expect(cantons[0]).toEqual({
      iri: "https://ld.admin.ch/canton/1",
      name: "Zürich",
    });
  });
});

describe("parseGeographyResults", () => {
  it("extracts short type name from type IRI", () => {
    const result: SparqlResult = {
      head: { vars: ["iri", "name", "type"] },
      results: {
        bindings: [
          makeBinding({
            iri: { value: "https://ld.admin.ch/canton/1", type: "uri" },
            name: { value: "Zürich", type: "literal" },
            type: { value: "https://schema.ld.admin.ch/Canton", type: "uri" },
          }),
        ],
      } as any,
    };
    const geo = parseGeographyResults(result);
    expect(geo[0].type).toBe("Canton");
  });
});

describe("parseSearchResults", () => {
  it("maps cube, title, description", () => {
    const result: SparqlResult = {
      head: { vars: ["cube", "title", "description"] },
      results: {
        bindings: [
          makeBinding({
            cube: { value: "https://ld.admin.ch/cube/1", type: "uri" },
            title: { value: "Forest Fire", type: "literal" },
            description: { value: "Daily danger levels", type: "literal" },
          }),
        ],
      } as any,
    };
    const results = parseSearchResults(result);
    expect(results[0]).toEqual({
      uri: "https://ld.admin.ch/cube/1",
      title: "Forest Fire",
      description: "Daily danger levels",
    });
  });
});

describe("parseResolveIri", () => {
  it("returns label and type for a found IRI", () => {
    const result: SparqlResult = {
      head: { vars: ["label", "type"] },
      results: {
        bindings: [
          makeBinding({
            label: { value: "Zürich", type: "literal", "xml:lang": "de" },
            type: { value: "https://schema.ld.admin.ch/Canton", type: "uri" },
          }),
        ],
      } as any,
    };
    const info = parseResolveIri(result, "https://ld.admin.ch/canton/1");
    expect(info.label).toBe("Zürich");
    expect(info.types).toContain("https://schema.ld.admin.ch/Canton");
  });

  it("returns empty result for unknown IRI", () => {
    const result: SparqlResult = {
      head: { vars: ["label", "type"] },
      results: { bindings: [] },
    };
    const info = parseResolveIri(result, "https://example.org/unknown");
    expect(info.label).toBe("");
    expect(info.types).toEqual([]);
  });
});

describe("parseDimensionSummary", () => {
  it("returns dimension paths with value counts", () => {
    const result: SparqlResult = {
      head: { vars: ["path", "name", "datatype", "valueCount"] },
      results: {
        bindings: [
          makeBinding({
            path: { value: "https://example.org/canton", type: "uri" },
            name: { value: "Canton", type: "literal" },
            valueCount: { value: "26", type: "literal" },
            hasNode: { value: "https://example.org/shape", type: "uri" },
          }),
          makeBinding({
            path: { value: "https://example.org/population", type: "uri" },
            name: { value: "Population", type: "literal" },
            datatype: { value: "http://www.w3.org/2001/XMLSchema#integer", type: "uri" },
            valueCount: { value: "0", type: "literal" },
          }),
        ],
      } as any,
    };
    const summary = parseDimensionSummary(result);
    expect(summary).toHaveLength(2);
    expect(summary[0].path).toBe("https://example.org/canton");
    expect(summary[0].valueCount).toBe("26");
    expect(summary[0].hasNestedShape).toBe(true);
    expect(summary[1].valueCount).toBe("0");
    expect(summary[1].hasNestedShape).toBe(false);
  });
});

describe("parseMunicipalities", () => {
  it("maps to iri and name", () => {
    const result: SparqlResult = {
      head: { vars: ["municipality", "name"] },
      results: {
        bindings: [
          makeBinding({
            municipality: { value: "https://ld.admin.ch/municipality/1", type: "uri" },
            name: { value: "Zürich", type: "literal" },
          }),
        ],
      } as any,
    };
    const m = parseMunicipalities(result);
    expect(m[0]).toEqual({ iri: "https://ld.admin.ch/municipality/1", name: "Zürich" });
  });
});

describe("parseDistricts", () => {
  it("maps to iri and name", () => {
    const result: SparqlResult = {
      head: { vars: ["district", "name"] },
      results: {
        bindings: [
          makeBinding({
            district: { value: "https://ld.admin.ch/district/1", type: "uri" },
            name: { value: "Bezirk Zürich", type: "literal" },
          }),
        ],
      } as any,
    };
    const d = parseDistricts(result);
    expect(d[0]).toEqual({ iri: "https://ld.admin.ch/district/1", name: "Bezirk Zürich" });
  });
});

describe("parseCubeMetadata", () => {
  it("returns metadata fields", () => {
    const result: SparqlResult = {
      head: { vars: ["title", "publisher", "license", "status"] },
      results: {
        bindings: [
          makeBinding({
            title: { value: "Population", type: "literal" },
            publisher: { value: "BFS", type: "literal" },
            license: { value: "https://creativecommons.org/", type: "uri" },
            status: { value: "https://ld.admin.ch/vocabulary/CreativeWorkStatus/Published", type: "uri" },
          }),
        ],
      } as any,
    };
    const meta = parseCubeMetadata(result);
    expect(meta.title).toBe("Population");
    expect(meta.publisher).toBe("BFS");
    expect(meta.license).toBe("https://creativecommons.org/");
  });

  it("returns empty metadata for no bindings", () => {
    const result: SparqlResult = {
      head: { vars: [] },
      results: { bindings: [] },
    };
    const meta = parseCubeMetadata(result);
    expect(meta.title).toBe("");
    expect(meta.description).toBe("");
  });
});

describe("parseCubeVersions", () => {
  it("returns version URIs with metadata", () => {
    const result: SparqlResult = {
      head: { vars: ["version", "dateModified", "status"] },
      results: {
        bindings: [
          makeBinding({
            version: { value: "https://ld.admin.ch/cube/1", type: "uri" },
            dateModified: { value: "2024-01-01", type: "literal" },
          }),
          makeBinding({
            version: { value: "https://ld.admin.ch/cube/2", type: "uri" },
            dateModified: { value: "2025-01-01", type: "literal" },
            status: { value: "https://ld.admin.ch/vocabulary/CreativeWorkStatus/Published", type: "uri" },
          }),
        ],
      } as any,
    };
    const versions = parseCubeVersions(result);
    expect(versions).toHaveLength(2);
    expect(versions[0].uri).toBe("https://ld.admin.ch/cube/1");
    expect(versions[1].status).toContain("Published");
  });
});

describe("parseCountByDimension", () => {
  it("returns value, label, count", () => {
    const result: SparqlResult = {
      head: { vars: ["dimValue", "dimLabel", "count"] },
      results: {
        bindings: [
          makeBinding({
            dimValue: { value: "https://ld.admin.ch/canton/1", type: "uri" },
            dimLabel: { value: "Zürich", type: "literal" },
            count: { value: "150", type: "literal" },
          }),
        ],
      } as any,
    };
    const items = parseCountByDimension(result);
    expect(items[0]).toEqual({
      value: "https://ld.admin.ch/canton/1",
      label: "Zürich",
      count: 150,
    });
  });

  it("falls back label to value when label missing", () => {
    const result: SparqlResult = {
      head: { vars: ["dimValue", "count"] },
      results: {
        bindings: [
          makeBinding({
            dimValue: { value: "2023", type: "literal" },
            count: { value: "500", type: "literal" },
          }),
        ],
      } as any,
    };
    const items = parseCountByDimension(result);
    expect(items[0].label).toBe("2023");
    expect(items[0].count).toBe(500);
  });
});