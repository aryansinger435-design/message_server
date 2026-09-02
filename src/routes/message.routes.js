import express from 'express';
import {
  sendMessage,
  getMessages,
  markAsRead,
  markAllAsRead,
  deleteMessage,
  addReaction,
} from '../controllers/message.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { messageSchema } from '../validators/message.validator.js';

const router = express.Router();

router.post('/', validate(messageSchema), sendMessage);
router.get('/:chatId', getMessages);
router.put('/:messageId/read', markAsRead);
router.put('/chat/:chatId/read-all', markAllAsRead);
router.delete('/:messageId', deleteMessage);
router.post('/:messageId/reactions', addReaction);

export default router;