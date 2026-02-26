import { Router } from "express";
import { IdentityController } from "../controllers/identity.controller";

const router = Router();
const controller = new IdentityController();

router.post("/identify", controller.identify.bind(controller));

export default router;
