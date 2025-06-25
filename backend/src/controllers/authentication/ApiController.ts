import { Request, Response } from "express";


export class ApiController {
  static test(request: Request, response: Response) {
    response.status(200).json({
      message: "Authentication service is running",
    });
  }
}