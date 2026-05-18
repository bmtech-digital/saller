import { Router } from 'express';
import multer from 'multer';
import { influencersController } from '../controllers/influencers.controller.js';
import { authMiddleware } from '../middleware/auth.js';

// Multer in-memory storage; size limit also enforced in the controller for the friendly error.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Customer-scoped routes (mounted at /api/customers via the customers router)
export const customerScopedInfluencersRouter = Router({ mergeParams: true });
customerScopedInfluencersRouter.use(authMiddleware);
customerScopedInfluencersRouter.get('/', (req, res) =>
  influencersController.listForCustomer(req, res),
);
customerScopedInfluencersRouter.post('/', (req, res) =>
  influencersController.create(req, res),
);
customerScopedInfluencersRouter.get('/receipts.zip', (req, res) =>
  influencersController.exportReceiptsZip(req, res),
);

// Top-level /api/influencers routes
const router = Router();
router.use(authMiddleware);
router.patch('/:id', (req, res) => influencersController.update(req, res));
router.delete('/:id', (req, res) => influencersController.delete(req, res));
router.patch('/:id/paid', (req, res) => influencersController.setPaid(req, res));
router.post('/:id/receipt', upload.single('file'), (req, res) =>
  influencersController.uploadReceipt(req, res),
);
router.get('/:id/receipt', (req, res) => influencersController.getReceiptUrl(req, res));
router.delete('/:id/receipt', (req, res) =>
  influencersController.deleteReceipt(req, res),
);

export default router;
