import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import * as UserController from '../controllers/user.controller.js';

const router = Router();

// Tất cả API user đều cần authenticate + requireAdmin
router.use(authenticate, requireAdmin);

// GET /api/users
router.get('/', UserController.getAll);

// POST /api/users
router.post('/', UserController.create);

// POST /api/users/bulk
router.post('/bulk', UserController.bulkCreate);

// PUT /api/users/:id
router.put('/:id', UserController.update);

// PUT /api/users/:id/status
router.put('/:id/status', UserController.toggleStatus);

// PUT /api/users/:id/reset-password
router.put('/:id/reset-password', UserController.resetPassword);

export default router;
