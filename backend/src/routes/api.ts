import { Router } from "express";
import { ApiController } from "@/controllers";

export default function (router: Router) {
  router.get(
    "/generate/audio",
    ApiController.generateAudio
  )

  return router;
}
