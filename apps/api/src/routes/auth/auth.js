import { Router } from 'express';
import signupRouter from './signup.js';
import loginRouter from './login.js';
import meRouter from './me.js';

const router = Router();

// Mount all auth routes
router.use(signupRouter);
router.use(loginRouter);
router.use(meRouter);

export default router;