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
import { resolveIriToolDef, handleResolveIri } from "./resolveIri.js";
import { getDimensionSummaryToolDef, handleGetDimensionSummary } from "./getDimensionSummary.js";
import { getMunicipalitiesToolDef, handleGetMunicipalities } from "./getMunicipalities.js";
import { getDistrictsToolDef, handleGetDistricts } from "./getDistricts.js";
import { getCubeMetadataToolDef, handleGetCubeMetadata } from "./getCubeMetadata.js";
import { getCubeVersionsToolDef, handleGetCubeVersions } from "./getCubeVersions.js";
import { countByDimensionToolDef, handleCountByDimension } from "./countByDimension.js";
import { getPageInfoToolDef, handleGetPageInfo } from "./getPageInfo.js";

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

const toolDefs: ToolDef[] = [
  listCubesToolDef,
  getCubeStructureToolDef,
  getDimensionValuesToolDef,
  getDimensionSummaryToolDef,
  queryObservationsToolDef,
  countObservationsToolDef,
  countByDimensionToolDef,
  getPageInfoToolDef,
  getCubeMetadataToolDef,
  getCubeVersionsToolDef,
  getCantonsToolDef,
  getMunicipalitiesToolDef,
  getDistrictsToolDef,
  resolveGeographyToolDef,
  resolveIriToolDef,
  searchDatasetsToolDef,
];

const dispatch: Record<string, (args: any) => Promise<string>> = {
  [listCubesToolDef.name]: handleListCubes,
  [getCubeStructureToolDef.name]: handleGetCubeStructure,
  [getDimensionValuesToolDef.name]: handleGetDimensionValues,
  [getDimensionSummaryToolDef.name]: handleGetDimensionSummary,
  [queryObservationsToolDef.name]: handleQueryObservations,
  [countObservationsToolDef.name]: handleCountObservations,
  [countByDimensionToolDef.name]: handleCountByDimension,
  [getPageInfoToolDef.name]: handleGetPageInfo,
  [getCubeMetadataToolDef.name]: handleGetCubeMetadata,
  [getCubeVersionsToolDef.name]: handleGetCubeVersions,
  [getCantonsToolDef.name]: handleGetCantons,
  [getMunicipalitiesToolDef.name]: handleGetMunicipalities,
  [getDistrictsToolDef.name]: handleGetDistricts,
  [resolveGeographyToolDef.name]: handleResolveGeography,
  [resolveIriToolDef.name]: handleResolveIri,
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