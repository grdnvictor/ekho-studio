// backend/src/agents/registry.ts
import { audioAgent } from "./audio/audio-agent";

// Registre centralisé des agents
export const agentRegistry = {
  audio: audioAgent,
  // Vous pouvez ajouter d'autres agents ici
  // video: videoAgent,
  // script: scriptAgent,
} as const;

export type AgentType = keyof typeof agentRegistry;

/**
 * Récupère un agent par son nom
 */
export function getAgent(agentType: AgentType) {
  const agent = agentRegistry[agentType];
  if (!agent) {
    throw new Error(`Agent '${agentType}' not found`);
  }
  return agent;
}

/**
 * Liste tous les agents disponibles
 */
export function getAvailableAgents(): AgentType[] {
  return Object.keys(agentRegistry) as AgentType[];
}

/**
 * Vérifie si un agent existe
 */
export function hasAgent(agentType: string): agentType is AgentType {
  return agentType in agentRegistry;
}