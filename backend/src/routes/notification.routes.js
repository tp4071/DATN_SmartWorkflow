import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as NotificationController from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', NotificationController.list);
router.get('/unread-count', NotificationController.unreadCount);
router.put('/mark-all-read', NotificationController.markAllRead);

export default router;
