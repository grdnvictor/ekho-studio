import { Router } from "express";
import { ApiController } from "@/controllers";
import { validateContract } from "@/middlewares";
import { GenerateAudioContract } from "@/contracts/api";

export default function (router: Router) {
  router.post(
    "/generate/audio",
    validateContract(GenerateAudioContract),
    ApiController.generateAudio
  )

  return router;
}
