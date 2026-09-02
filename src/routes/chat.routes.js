import express from 'express';
import {
  createChat,
  getChats,
  getChatById,
  updateChat,
  deleteChat,
  addParticipants,
  removeParticipants,
  muteChat,
  unmuteChat,
  pinChat,
  unpinChat,
  getChatMessages,
} from '../controllers/chat.controller.js';

const router = express.Router();

router.post('/', createChat);
router.get('/', getChats);
router.get('/:id', getChatById);
router.put('/:id', updateChat);
router.delete('/:id', deleteChat);
router.post('/:id/participants', addParticipants);
router.delete('/:id/participants/:userId', removeParticipants);
router.put('/:id/mute', muteChat);
router.put('/:id/unmute', unmuteChat);
router.put('/:id/pin', pinChat);
router.put('/:id/unpin', unpinChat);
router.get('/:id/messages', getChatMessages);

export default router;