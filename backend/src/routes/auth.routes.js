import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller.js';
import { loginRateLimit } from '../middlewares/rateLimit.middleware.js';

const router = Router();

// POST /api/auth/login — có rate limit để chống brute-force.
router.post('/login', loginRateLimit, AuthController.login);

export default router;
