import express from 'express';
import {
  getCurrentUser,
  getUsers,
  getUserById,
  updateUser,
  updateAvatar,
  getFriends,
  addFriend,
  removeFriend,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  searchUsers,
} from '../controllers/user.controller.js';
import { upload } from '../middleware/upload.middleware.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all user routes
router.use(authenticateToken);

router.get('/me', getCurrentUser);
router.get('/', getUsers);
router.get('/search', searchUsers);
router.get('/friends', getFriends);
router.get('/friend-requests', getFriendRequests);
router.get('/:id', getUserById);
router.put('/', updateUser);
router.put('/avatar', upload.single('avatar'), updateAvatar);
router.post('/friends/:friendId', addFriend);
router.delete('/friends/:friendId', removeFriend);
router.put('/friend-requests/:requestId/accept', acceptFriendRequest);
router.put('/friend-requests/:requestId/reject', rejectFriendRequest);

export default router;