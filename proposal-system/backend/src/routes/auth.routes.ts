import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/login', (req, res) => authController.login(req, res));
router.post('/refresh', (req, res) => authController.refresh(req, res));

// Protected routes
router.post('/logout', authMiddleware, (req, res) => authController.logout(req, res));
router.get('/me', authMiddleware, (req, res) => authController.me(req, res));

// Admin only (consider adding admin middleware in production)
router.post('/register', (req, res) => authController.register(req, res));

export default router;
