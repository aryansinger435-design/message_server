import express from 'express';
import {
  createStatus,
  getRecentStatuses,
  getMyStatuses,
  viewStatus,
  deleteStatus,
} from '../controllers/status.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/', upload.single('media'), createStatus);
router.get('/recent', getRecentStatuses);
router.get('/me', getMyStatuses);
router.post('/:statusId/view', viewStatus);
router.delete('/:statusId', deleteStatus);

export default router;
