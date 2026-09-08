import express from 'express';
import { getCallHistory, logCall } from '../controllers/call.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/history', getCallHistory);
router.post('/log', logCall);

export default router;
