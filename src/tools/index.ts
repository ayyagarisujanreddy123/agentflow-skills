import { ToolDef } from "./types.js";
import { readTool } from "./read.js";
import { searchTool } from "./search.js";
import { genTool } from "./gen.js";
import { reviewTool } from "./review.js";
import { summarizeTool } from "./summarize.js";
import { transformTool } from "./transform.js";
import { askTool } from "./ask.js";

export const allTools: ToolDef[] = [
  readTool,
  searchTool,
  genTool,
  reviewTool,
  summarizeTool,
  transformTool,
  askTool
];
