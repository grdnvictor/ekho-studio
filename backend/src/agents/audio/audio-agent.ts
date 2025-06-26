import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { loadAgentPromptWithVariables } from "@/utils/prompt-loader";
import { audioGenerationTool, voiceSelectionTool } from "./tools";

const audioAgentPrompt = loadAgentPromptWithVariables('audio');

const agentModel = new ChatOpenAI({ 
  temperature: 0.7,
  model: "gpt-4o",
});

const agentCheckpointer = new MemorySaver();

export const audioAgent = createReactAgent({
  prompt: audioAgentPrompt,
  llm: agentModel,
  tools: [
    voiceSelectionTool,
    audioGenerationTool,
  ],
  checkpointSaver: agentCheckpointer,
});