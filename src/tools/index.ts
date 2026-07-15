import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { listCubesToolDef, handleListCubes } from "./listCubes.js";
import { getCubeStructureToolDef, handleGetCubeStructure } from "./getCubeStructure.js";
import {
  getDimensionValuesToolDef,
  handleGetDimensionValues,
} from "./getDimensionValues.js";
import { queryObservationsToolDef, handleQueryObservations } from "./queryObservations.js";
import { countObservationsToolDef, handleCountObservations } from "./countObservations.js";
import { getCantonsToolDef, handleGetCantons } from "./getCantons.js";
import { resolveGeographyToolDef, handleResolveGeography } from "./resolveGeography.js";
import { searchDatasetsToolDef, handleSearchDatasets } from "./searchDatasets.js";

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const toolDefs: ToolDef[] = [
  listCubesToolDef,
  getCubeStructureToolDef,
  getDimensionValuesToolDef,
  queryObservationsToolDef,
  countObservationsToolDef,
  getCantonsToolDef,
  resolveGeographyToolDef,
  searchDatasetsToolDef,
];

const dispatch: Record<string, (args: any) => Promise<string>> = {
  [listCubesToolDef.name]: handleListCubes,
  [getCubeStructureToolDef.name]: handleGetCubeStructure,
  [getDimensionValuesToolDef.name]: handleGetDimensionValues,
  [queryObservationsToolDef.name]: handleQueryObservations,
  [countObservationsToolDef.name]: handleCountObservations,
  [getCantonsToolDef.name]: handleGetCantons,
  [resolveGeographyToolDef.name]: handleResolveGeography,
  [searchDatasetsToolDef.name]: handleSearchDatasets,
};

export const allToolDefs = toolDefs;

export async function dispatchTool(
  name: string,
  args: any
): Promise<string> {
  const handler = dispatch[name];
  if (!handler) {
    return JSON.stringify({
      error: true,
      message: `Unknown tool: ${name}`,
    });
  }
  return handler(args ?? {});
}