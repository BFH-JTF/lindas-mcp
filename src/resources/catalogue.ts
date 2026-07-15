import { buildListCubesQuery } from "../sparql/queryBuilder.js";
import { executeSparqlQuery } from "../sparql/client.js";
import { parseCubes, type CubeInfo } from "../sparql/resultParser.js";

export const CATALOGUE_RESOURCE_URI = "lindas:///cubes";
export const CATALOGUE_RESOURCE_NAME = "LINDAS Cube Catalogue";
export const CATALOGUE_RESOURCE_DESCRIPTION =
  "Catalogue of available data cubes on LINDAS";

export async function readCatalogue(): Promise<string> {
  const result = await executeSparqlQuery(buildListCubesQuery(100, 0));
  const cubes = parseCubes(result);

  if (cubes.length === 0) {
    return "# LINDAS Cube Catalogue\n\nNo cubes found.\n";
  }

  const lines: string[] = ["# LINDAS Cube Catalogue", ""];
  for (const cube of cubes) {
    lines.push(`## ${cube.title || "(untitled)"}`);
    lines.push(`- URI: \`${cube.uri}\``);
    if (cube.description) {
      lines.push(`- Description: ${cube.description}`);
    }
    if (cube.dateModified) {
      lines.push(`- Modified: ${cube.dateModified}`);
    }
    if (cube.status) {
      lines.push(`- Status: ${cube.status}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export const catalogueResource = {
  uri: CATALOGUE_RESOURCE_URI,
  name: CATALOGUE_RESOURCE_NAME,
  description: CATALOGUE_RESOURCE_DESCRIPTION,
  mimeType: "text/markdown",
  read: readCatalogue,
};