import { Router } from 'express';
import { logsController } from '../controllers/logs.controller.js';

const router = Router();

// Public endpoint to log errors (from frontend)
router.post('/log', logsController.logError);

// Admin authentication
router.post('/auth', logsController.authenticate);
router.post('/logout', logsController.logout);

// Protected endpoints (require logs session token)
router.get('/', logsController.getLogs);
router.patch('/:id/resolve', logsController.resolveError);
router.get('/:id/claude', logsController.getErrorForClaude);
router.delete('/cleanup', logsController.cleanupLogs);

export default router;
