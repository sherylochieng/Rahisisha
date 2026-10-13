import { Router } from 'express';
import signupRouter from './signup.js';
import loginRouter from './login.js';

const router = Router();

router.use(signupRouter);
router.use(loginRouter);

export default router;