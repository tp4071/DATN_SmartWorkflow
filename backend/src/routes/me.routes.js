import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import * as MyTasksController from '../controllers/myTasks.controller.js';
import * as MeController from '../controllers/me.controller.js';

const router = Router();

router.use(authenticate);

// GET /api/me/tasks?status=<optional>&due=<overdue|today|this_week|no_due>
//  - Trả về task được giao cho user hiện tại trên mọi project mà user tham gia.
router.get('/tasks', MyTasksController.listMyTasks);

// PUT /api/me/password
//  - Đổi mật khẩu cho user hiện tại. Body: { current_password, new_password }.
router.put('/password', MeController.changePassword);

export default router;
