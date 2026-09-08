import express from 'express';
import {
  sendMessage,
  getMessages,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  addReaction,
  uploadAttachment,
} from '../controllers/message.controller.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/upload', upload.single('file'), uploadAttachment);
router.post('/', sendMessage);
router.get('/:chatId', getMessages);
router.put('/:messageId/read', markAsRead);
router.put('/chat/:chatId/read-all', markAllAsRead);
router.post('/:messageId/delete', deleteMessage);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/reactions', addReaction);

export default router;