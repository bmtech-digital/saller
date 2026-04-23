import { Router } from 'express';
import { customersController } from '../controllers/customers.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', (req, res) => customersController.getAll(req, res));
router.get('/search', (req, res) => customersController.search(req, res));
router.get('/:id', (req, res) => customersController.getOne(req, res));
router.post('/', (req, res) => customersController.create(req, res));
router.put('/:id', (req, res) => customersController.update(req, res));
router.delete('/:id', (req, res) => customersController.delete(req, res));

export default router;
