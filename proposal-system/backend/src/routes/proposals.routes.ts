import { Router } from 'express';
import { proposalsController } from '../controllers/proposals.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Proposals CRUD
router.get('/', (req, res) => proposalsController.getAll(req, res));
router.get('/:id', (req, res) => proposalsController.getOne(req, res));
router.post('/', (req, res) => proposalsController.create(req, res));
router.put('/:id', (req, res) => proposalsController.update(req, res));
router.delete('/:id', (req, res) => proposalsController.delete(req, res));

// Blocks
router.post('/:id/blocks', (req, res) => proposalsController.addBlock(req, res));
router.put('/:id/blocks/:blockId', (req, res) => proposalsController.updateBlock(req, res));
router.delete('/:id/blocks/:blockId', (req, res) => proposalsController.deleteBlock(req, res));

// Text items
router.post('/:id/blocks/:blockId/text-items', (req, res) => proposalsController.addTextItem(req, res));
router.put('/:id/text-items/:textItemId', (req, res) => proposalsController.updateTextItem(req, res));
router.delete('/:id/text-items/:textItemId', (req, res) => proposalsController.deleteTextItem(req, res));

// Actions
router.post('/:id/generate-pdf', (req, res) => proposalsController.generatePDF(req, res));
router.post('/:id/send', (req, res) => proposalsController.sendToClient(req, res));

export default router;
