import { CONFIG } from "../config.js";

export interface SparqlResult {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
}

export interface SparqlBinding {
  [key: string]: {
    type: "uri" | "literal" | "typed-literal" | "bnode";
    value: string;
    "xml:lang"?: string;
    datatype?: string;
  };
}

export class SparqlError extends Error {
  query?: string;
  statusCode?: number;

  constructor(
    message: string,
    options?: { query?: string; statusCode?: number }
  ) {
    super(message);
    this.name = "SparqlError";
    this.query = options?.query
      ? options.query.slice(0, 500)
      : undefined;
    this.statusCode = options?.statusCode;
  }
}

export async function executeSparqlQuery(
  query: string
): Promise<SparqlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    CONFIG.requestTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(CONFIG.sparqlEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `query=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new SparqlError(
        `SPARQL query timed out after ${CONFIG.requestTimeoutMs}ms`,
        { query }
      );
    }
    throw new SparqlError(
      `Network error executing SPARQL query: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { query }
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw new SparqlError(
      `SPARQL endpoint returned ${response.status}: ${bodyText.slice(0, 1000)}`,
      { query, statusCode: response.status }
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/sparql-results+json") &&
      !contentType.includes("application/json")) {
    const bodyText = await response.text().catch(() => "");
    throw new SparqlError(
      `SPARQL endpoint returned unexpected content type "${contentType}": ${bodyText.slice(0, 500)}`,
      { query, statusCode: response.status }
    );
  }

  try {
    return (await response.json()) as SparqlResult;
  } catch (err) {
    throw new SparqlError(
      `Failed to parse SPARQL JSON response: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { query }
    );
  }
}