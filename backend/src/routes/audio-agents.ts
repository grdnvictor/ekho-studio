// backend/src/routes/audio-agents.ts
import { Router } from "express";
import { AudioAgentController } from "@/controllers/audio/AudioAgentController";
import { validateContract } from "@/middlewares";
import { AudioAgentChatContract, AudioProjectContract } from "@/contracts/api/AudioAgentContracts";

export default function (router: Router) {
  // Chat interactif avec l'agent audio
  router.post(
    "/audio-agent/chat",
    validateContract(AudioAgentChatContract),
    AudioAgentController.chat
  );

  // Génération complète d'un projet audio
  router.post(
    "/audio-agent/generate-project",
    validateContract(AudioProjectContract),
    AudioAgentController.generateProject
  );

  return router;
}