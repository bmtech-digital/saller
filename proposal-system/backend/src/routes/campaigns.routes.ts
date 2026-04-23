import { Router } from 'express';
import { campaignsController } from '../controllers/campaigns.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/customer/:customerId', (req, res) => campaignsController.getByCustomer(req, res));
router.post('/customer/:customerId', (req, res) => campaignsController.create(req, res));
router.put('/:id', (req, res) => campaignsController.update(req, res));
router.delete('/:id', (req, res) => campaignsController.delete(req, res));

export default router;
