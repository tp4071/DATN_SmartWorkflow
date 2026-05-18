import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import * as SystemAnalyticsController from '../controllers/systemAnalytics.controller.js';

const router = Router();

router.use(authenticate, requireAdmin);

// GET /api/admin/stats/overview — số liệu tổng quan cho dashboard
router.get('/stats/overview', SystemAnalyticsController.overview);

export default router;
