import { Router } from 'express';
import authRoutes from './auth.routes.js';
import customersRoutes from './customers.routes.js';
import proposalsRoutes from './proposals.routes.js';
import campaignsRoutes from './campaigns.routes.js';
import clientRoutes from './client.routes.js';
import logsRoutes from './logs.routes.js';

const router = Router();

// API routes
router.use('/auth', authRoutes);
router.use('/customers', customersRoutes);
router.use('/proposals', proposalsRoutes);
router.use('/campaigns', campaignsRoutes);

// Public client routes (for signing)
router.use('/client', clientRoutes);

// Error logs (admin only - separate password)
router.use('/logs', logsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
