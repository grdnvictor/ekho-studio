import { Router } from "express";
import { AudioController, AudioAgentController } from "@/controllers";
import { validateContract } from "@/middlewares";
import { 
  GenerateAudioContract, 
  AudioAgentChatContract, 
  AudioProjectContract 
} from "@/contracts/api";

export default function (router: Router) {
  router.post(
    "/generate/audio",
    validateContract(GenerateAudioContract),
    AudioController.generateAudio
  );

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