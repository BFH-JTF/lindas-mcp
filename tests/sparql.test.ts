import { describe, it, expect } from "vitest";
import {
  buildListCubesQuery,
  buildCubeStructureQuery,
  buildDimensionValuesQuery,
  buildQueryObservationsQuery,
  buildCountObservationsQuery,
  buildGetCantonsQuery,
  buildResolveGeographyQuery,
  buildSearchDatasetsQuery,
  buildResolveIriQuery,
  buildDimensionSummaryQuery,
  buildGetMunicipalitiesQuery,
  buildGetDistrictsQuery,
  buildCubeMetadataQuery,
  buildCubeVersionsQuery,
  buildCountByDimensionQuery,
  escapeSparqlLiteral,
  type ObservationFilter,
} from "../src/sparql/queryBuilder.js";

describe("buildListCubesQuery", () => {
  it("includes LIMIT and OFFSET with ?cube, ?title", () => {
    const q = buildListCubesQuery(20, 0);
    expect(q).toContain("LIMIT 20");
    expect(q).toContain("OFFSET 0");
    expect(q).toContain("?cube");
    expect(q).toContain("?title");
    expect(q).toContain("cube:Cube");
  });

  it("handles different pagination", () => {
    const q = buildListCubesQuery(50, 100);
    expect(q).toContain("LIMIT 50");
    expect(q).toContain("OFFSET 100");
  });

  it("includes PREFIX block", () => {
    const q = buildListCubesQuery(10, 0);
    expect(q).toContain("PREFIX cube:");
    expect(q).toContain("PREFIX schema:");
  });

  it("selects status field", () => {
    const q = buildListCubesQuery(10, 0);
    expect(q).toContain("?status");
    expect(q).toContain("creativeWorkStatus");
  });

  it("uses custom language", () => {
    const q = buildListCubesQuery(10, 0, "fr");
    expect(q).toContain('"fr"');
  });

  it("filters by Published status", () => {
    const q = buildListCubesQuery(10, 0, "de", "https://ld.admin.ch/vocabulary/CreativeWorkStatus/Published");
    expect(q).toContain("creativeWorkStatus");
    expect(q).toContain("<https://ld.admin.ch/vocabulary/CreativeWorkStatus/Published>");
  });

  it("omits status filter when undefined", () => {
    const q = buildListCubesQuery(10, 0, "de", undefined);
    expect(q).toContain("OPTIONAL { ?cube schema:creativeWorkStatus");
    expect(q).not.toContain("creativeWorkStatus > <");
  });
});

describe("buildCubeStructureQuery", () => {
  it("contains cube URI, sh:property, sh:path", () => {
    const q = buildCubeStructureQuery("https://example.org/cube");
    expect(q).toContain("<https://example.org/cube>");
    expect(q).toContain("sh:property");
    expect(q).toContain("sh:path");
  });

  it("includes hasNode, hasIn, nodeKind for nested shape detection", () => {
    const q = buildCubeStructureQuery("https://example.org/cube");
    expect(q).toContain("?hasNode");
    expect(q).toContain("?hasIn");
    expect(q).toContain("?nodeKind");
  });

  it("uses custom language", () => {
    const q = buildCubeStructureQuery("https://example.org/cube", "it");
    expect(q).toContain('"it"');
  });
});

describe("buildDimensionValuesQuery", () => {
  it("contains DISTINCT, dimension path, schema:name, language filter", () => {
    const q = buildDimensionValuesQuery(
      "https://example.org/cube",
      "https://example.org/dim",
      50,
      "de"
    );
    expect(q).toContain("DISTINCT");
    expect(q).toContain("<https://example.org/dim>");
    expect(q).toContain("schema:name");
    expect(q).toContain('"de"');
  });

  it("uses COALESCE for label fallback", () => {
    const q = buildDimensionValuesQuery(
      "https://example.org/cube",
      "https://example.org/dim",
      10,
      "fr"
    );
    expect(q).toContain("COALESCE");
  });
});

describe("buildQueryObservationsQuery", () => {
  const baseParams = {
    cubeUri: "https://example.org/cube",
    dimensions: [],
    measures: [],
    filters: [],
    limit: 50,
    offset: 0,
    language: "de",
  };

  it("with no filters has only OPTIONAL clauses", () => {
    const q = buildQueryObservationsQuery({
      ...baseParams,
      dimensions: ["https://example.org/dim1"],
      measures: ["https://example.org/mea1"],
    });
    expect(q).toContain("OPTIONAL");
    expect(q).toContain("?dim_0");
    expect(q).toContain("?mea_0");
    expect(q).not.toContain("FILTER(?filter");
  });

  it("with one IRI filter contains FILTER with IRI", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/dim1", value: "https://example.org/value", operator: "=" },
    ];
    const q = buildQueryObservationsQuery({
      ...baseParams,
      dimensions: ["https://example.org/dim1"],
      filters,
    });
    expect(q).toContain("FILTER(?dim_0 = <https://example.org/value>)");
  });

  it("with one literal filter contains FILTER with STR for numeric values", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/dim1", value: "2023", operator: "=" },
    ];
    const q = buildQueryObservationsQuery({
      ...baseParams,
      filters,
    });
    expect(q).toContain('STR(?filter_0) = "2023"');
    expect(q).not.toContain("?filter_0 = \"2023\"");
  });

  it("with multiple filters uses separate filter vars", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/dim1", value: "2023", operator: "=" },
      { dimension: "https://example.org/dim2", value: "https://example.org/val", operator: "!=" },
    ];
    const q = buildQueryObservationsQuery({
      ...baseParams,
      filters,
    });
    expect(q).toContain("?filter_0");
    expect(q).toContain("?filter_1");
    expect(q).toContain('STR(?filter_0) = "2023"');
    expect(q).toContain("FILTER(?filter_1 != <https://example.org/val>)");
  });

  it("reuses dimension var when filter dimension matches selected dimension", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/dim1", value: "2023", operator: "=" },
    ];
    const q = buildQueryObservationsQuery({
      ...baseParams,
      dimensions: ["https://example.org/dim1"],
      filters,
    });
    expect(q).toContain('STR(?dim_0) = "2023"');
    expect(q).not.toContain("?filter_0");
  });

  it("uses STR() for numeric equality comparisons", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/year", value: "2023", operator: "=" },
    ];
    const q = buildQueryObservationsQuery({
      ...baseParams,
      filters,
    });
    expect(q).toContain('STR(?filter_0) = "2023"');
  });

  it("uses xsd:decimal cast for numeric range comparisons", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/year", value: "2015", operator: ">=" },
    ];
    const q = buildQueryObservationsQuery({
      ...baseParams,
      filters,
    });
    expect(q).toContain("xsd:integer(STR(?filter_0))");
    expect(q).toContain(">= 2015)");
  });

  it("includes LIMIT and OFFSET", () => {
    const q = buildQueryObservationsQuery({
      ...baseParams,
      dimensions: ["https://example.org/dim1"],
      limit: 100,
      offset: 200,
    });
    expect(q).toContain("LIMIT 100");
    expect(q).toContain("OFFSET 200");
  });
});

describe("buildCountObservationsQuery", () => {
  it("selects COUNT with no filters", () => {
    const q = buildCountObservationsQuery("https://example.org/cube", []);
    expect(q).toContain("(COUNT(?obs) AS ?count)");
  });

  it("applies filters", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/dim1", value: "2023", operator: "=" },
    ];
    const q = buildCountObservationsQuery("https://example.org/cube", filters);
    expect(q).toContain("?filter_0");
    expect(q).toContain('STR(?filter_0) = "2023"');
  });

  it("uses xsd:integer(STR()) cast for numeric comparison in count", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/year", value: "2010", operator: ">=" },
    ];
    const q = buildCountObservationsQuery("https://example.org/cube", filters);
    expect(q).toContain("xsd:integer(STR(?filter_0))");
  });
});

describe("buildGetCantonsQuery", () => {
  it("selects Canton instances with language filter", () => {
    const q = buildGetCantonsQuery("de");
    expect(q).toContain("https://schema.ld.admin.ch/Canton");
    expect(q).toContain('"de"');
    expect(q).toContain("ORDER BY ?name");
  });
});

describe("buildResolveGeographyQuery", () => {
  it("contains CONTAINS and language filter", () => {
    const q = buildResolveGeographyQuery("Zürich", "de");
    expect(q).toContain("CONTAINS");
    expect(q).toContain("LCASE");
    expect(q).toContain('"de"');
  });

  it("escapes quotes in search term", () => {
    const q = buildResolveGeographyQuery("test\"quote", "de");
    expect(q).toContain('test\\"quote');
  });

  it("limits to 20 results", () => {
    const q = buildResolveGeographyQuery("Bern", "de");
    expect(q).toContain("LIMIT 20");
  });
});

describe("buildSearchDatasetsQuery", () => {
  it("uses CONTAINS filter, no textMatch", () => {
    const q = buildSearchDatasetsQuery("forest", 10);
    expect(q).toContain("CONTAINS");
    expect(q).not.toContain("textMatch");
  });

  it("includes LIMIT", () => {
    const q = buildSearchDatasetsQuery("forest", 10);
    expect(q).toContain("LIMIT 10");
  });

  it("escapes search text", () => {
    const q = buildSearchDatasetsQuery('evil"query', 5);
    expect(q).toContain('evil\\"query');
  });

  it("uses custom language", () => {
    const q = buildSearchDatasetsQuery("forest", 10, "en");
    expect(q).toContain('"en"');
  });
});

describe("escapeSparqlLiteral", () => {
  it("escapes backslash first", () => {
    expect(escapeSparqlLiteral("a\\b")).toBe("a\\\\b");
  });

  it("escapes double quotes", () => {
    expect(escapeSparqlLiteral('a"b')).toBe('a\\"b');
  });

  it("escapes newlines", () => {
    expect(escapeSparqlLiteral("a\nb")).toBe("a\\nb");
  });

  it("escapes carriage returns", () => {
    expect(escapeSparqlLiteral("a\rb")).toBe("a\\rb");
  });
});

describe("buildResolveIriQuery", () => {
  it("selects label and type for an IRI", () => {
    const q = buildResolveIriQuery("https://ld.admin.ch/canton/1", "de");
    expect(q).toContain("<https://ld.admin.ch/canton/1>");
    expect(q).toContain("schema:name ?label");
    expect(q).toContain('"de"');
    expect(q).toContain("a ?type");
  });
});

describe("buildDimensionSummaryQuery", () => {
  it("contains cube URI and dimension summary patterns", () => {
    const q = buildDimensionSummaryQuery("https://example.org/cube", "de");
    expect(q).toContain("<https://example.org/cube>");
    expect(q).toContain("sh:property");
    expect(q).toContain("sh:path");
    expect(q).toContain("COUNT(DISTINCT ?val)");
    expect(q).toContain("?valueCount");
  });
});

describe("buildGetMunicipalitiesQuery", () => {
  it("queries municipalities with language filter", () => {
    const q = buildGetMunicipalitiesQuery("de");
    expect(q).toContain("Municipality");
    expect(q).toContain('"de"');
  });

  it("adds canton filter when canton_iri provided", () => {
    const q = buildGetMunicipalitiesQuery("de", "https://ld.admin.ch/canton/1");
    expect(q).toContain("<https://ld.admin.ch/canton/1>");
  });
});

describe("buildGetDistrictsQuery", () => {
  it("queries districts with language filter", () => {
    const q = buildGetDistrictsQuery("fr");
    expect(q).toContain("District");
    expect(q).toContain('"fr"');
  });
});

describe("buildCubeMetadataQuery", () => {
  it("selects publisher, license, status, dates", () => {
    const q = buildCubeMetadataQuery("https://example.org/cube");
    expect(q).toContain("?publisher");
    expect(q).toContain("?license");
    expect(q).toContain("?status");
    expect(q).toContain("?dateCreated");
    expect(q).toContain("?dateModified");
    expect(q).toContain("?datePublished");
  });
});

describe("buildCubeVersionsQuery", () => {
  it("strips version suffix and searches for siblings", () => {
    const q = buildCubeVersionsQuery("https://example.org/cube/3");
    expect(q).toContain("STRSTARTS");
    expect(q).toContain("https://example.org/cube");
  });
});

describe("buildCountByDimensionQuery", () => {
  it("groups by dimension value with count", () => {
    const q = buildCountByDimensionQuery(
      "https://example.org/cube",
      "https://example.org/canton",
      [],
      50,
      "de"
    );
    expect(q).toContain("COUNT(?obs)");
    expect(q).toContain("GROUP BY");
    expect(q).toContain("?dimValue");
    expect(q).toContain("schema:name ?dimLabel");
    expect(q).toContain("LIMIT 50");
  });

  it("applies filters", () => {
    const filters: ObservationFilter[] = [
      { dimension: "https://example.org/year", value: "2023", operator: "=" },
    ];
    const q = buildCountByDimensionQuery(
      "https://example.org/cube",
      "https://example.org/canton",
      filters,
      10,
      "de"
    );
    expect(q).toContain("?filter_0");
    expect(q).toContain('"2023"');
  });
});