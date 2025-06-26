// backend/src/agents/audio/audio-agent.ts

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { loadAgentPromptWithVariables } from "@/utils/prompt-loader";
import {
  audioGenerationTool,
  voiceSelectionTool,
  scriptOptimizationTool,
} from "@/agents/audio/tools";

// Chargement du prompt
const audioAgentPrompt = loadAgentPromptWithVariables("audio");

// Configuration LangChain pour LM Studio
const agentModel = new ChatOpenAI({
  temperature: 0.7,
  modelName: "local-model",
  openAIApiKey: "lm-studio", // Factice
  configuration: {
    baseURL: "http://localhost:1234/v1", // LM Studio local
    apiKey: "not-needed"
  },
});

const agentCheckpointer = new MemorySaver();

export const audioAgent = createReactAgent({
  prompt: audioAgentPrompt,
  llm: agentModel,
  tools: [
    voiceSelectionTool,
    audioGenerationTool,
    scriptOptimizationTool,
  ],
  checkpointSaver: agentCheckpointer,
});
