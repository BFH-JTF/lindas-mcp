export interface PromptDef {
  name: string;
  description: string;
  arguments?: { name: string; description: string; required: boolean }[];
  messages: (args: Record<string, string>) => {
    role: "user";
    content: { type: "text"; text: string };
  }[];
}

export const dataExplorationPrompt: PromptDef = {
  name: "data_exploration",
  description: "Step-by-step guide for exploring LINDAS data",
  messages: () => [
    {
      role: "user",
      content: {
        type: "text",
        text: `You are helping the user explore Swiss federal data on LINDAS.

Follow this workflow:
1. Ask what topic the user is interested in (e.g., population, environment, economy)
2. Use search_datasets to find relevant cubes
3. Use get_cube_structure to understand the cube's dimensions and measures
4. Use get_dimension_values to discover what values key dimensions can take
5. Use resolve_geography if the user mentions a place name
6. Use count_observations to check result size before querying
7. Use query_observations to retrieve the data
8. Summarize the results in the user's language

Always show the data in a clear table format. If results are large, offer to
filter further or narrow the time range. Use get_cantons to list cantons if
the user wants to compare across regions.`,
      },
    },
  ],
};

export const cantonComparisonPrompt: PromptDef = {
  name: "canton_comparison",
  description: "Compare a topic across all Swiss cantons for a given year",
  arguments: [
    { name: "topic", description: "The topic to compare (e.g., population, unemployment)", required: true },
    { name: "year", description: "The year to compare", required: true },
  ],
  messages: (args) => {
    const topic = args?.topic ?? "{topic}";
    const year = args?.year ?? "{year}";
    return [
      {
        role: "user",
        content: {
          type: "text",
          text: `Compare ${topic} across all Swiss cantons for the year ${year}.

1. Use search_datasets to find cubes about "${topic}"
2. Get the structure of the most relevant cube
3. Get canton dimension values to see all available cantons
4. Query observations for all cantons for ${year}
5. Present results as a ranked table: Canton | Value
6. Highlight the highest and lowest values
7. Note any cantons with missing data`,
        },
      },
    ];
  },
};

export const allPrompts: PromptDef[] = [
  dataExplorationPrompt,
  cantonComparisonPrompt,
];