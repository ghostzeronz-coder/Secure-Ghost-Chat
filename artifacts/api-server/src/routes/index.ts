import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stripeRouter from "./stripe";
import cryptoRouter from "./crypto";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stripeRouter);
router.use(cryptoRouter);
router.use(walletRouter);

export default router;
