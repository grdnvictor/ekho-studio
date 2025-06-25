import { Router } from "express";
import { ApiController } from "@/controllers";

export default function (router: Router) {
  router.get(
    "/test",
    ApiController.test
  )

  return router;
}
