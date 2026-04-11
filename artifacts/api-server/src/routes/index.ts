import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stripeRouter from "./stripe";
import cryptoRouter from "./crypto";
import walletRouter from "./wallet";
import tokensRouter from "./tokens";
import prekeysRouter from "./prekeys";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stripeRouter);
router.use(cryptoRouter);
router.use(walletRouter);
router.use(tokensRouter);
router.use(prekeysRouter);
router.use(messagesRouter);

export default router;
