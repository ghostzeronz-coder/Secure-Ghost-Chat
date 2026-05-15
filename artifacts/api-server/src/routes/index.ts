import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stripeRouter from "./stripe";
import cryptoRouter from "./crypto";
import walletRouter from "./wallet";
import tokensRouter from "./tokens";
import prekeysRouter from "./prekeys";
import messagesRouter from "./messages";
import numbersRouter from "./numbers";
import invitesRouter from "./invites";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stripeRouter);
router.use(cryptoRouter);
router.use(walletRouter);
router.use(tokensRouter);
router.use(prekeysRouter);
router.use(messagesRouter);
router.use(numbersRouter);
router.use(invitesRouter);

export default router;
