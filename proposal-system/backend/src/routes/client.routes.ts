import { Router } from 'express';
import { clientController } from '../controllers/client.controller.js';

const router = Router();

// Public routes (no authentication required)
// These routes use the client token for access

// Get proposal for signing
router.get('/:token', (req, res) => clientController.getProposal(req, res));

// Get PDF preview
router.get('/:token/pdf', (req, res) => clientController.getPreviewPDF(req, res));

// Submit signature
router.post('/:token/sign', (req, res) => clientController.submitSignature(req, res));

export default router;
