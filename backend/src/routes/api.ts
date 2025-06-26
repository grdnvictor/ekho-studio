import { Router } from "express";
import { AudioController } from "@/controllers";
import { validateContract } from "@/middlewares";
import { GenerateAudioContract } from "@/contracts/api";

export default function (router: Router) {
  router.post(
    "/generate/audio",
    validateContract(GenerateAudioContract),
    AudioController.generateAudio
  )

  return router;
}
