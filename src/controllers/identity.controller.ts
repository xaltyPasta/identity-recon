import { Request, Response } from "express";
import { IdentityService } from "../services/identity.service";

export class IdentityController {
  private identityService = new IdentityService();

  async identify(req: Request, res: Response): Promise<Response> {
    try {
      const { email, phoneNumber } = req.body;

      const result = await this.identityService.reconcile({
        email,
        phoneNumber
      });

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({
        error: error.message || "Something went wrong"
      });
    }
  }
}
