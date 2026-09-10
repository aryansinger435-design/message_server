import { User } from '../models/User.model.js';
import { Message } from '../models/Message.model.js';
import { Chat } from '../models/Chat.model.js';
import { Call } from '../models/Call.model.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, verifyJwtToken } from '../config/jwt.js';

// Track online user sockets: Map<userIdString, Set<socketId>>
const userSockets = new Map();
// Track active calls: Map<userIdString, { withUser: string, callType: string }>
const activeCalls = new Map();

export const initializeSocket = (io) => {
  // Authentication Middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyJwtToken(token, jwt);
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    console.log(`⚡ User connected: ${socket.user.username} (${socket.id})`);

    // Register user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Update user status in DB and broadcast to all connected clients
    User.findByIdAndUpdate(socket.user._id, {
      status: 'online',
      lastSeen: new Date(),
    }).then(() => {
      io.emit('user-status', {
        userId: socket.user._id,
        status: 'online',
        lastSeen: new Date(),
      });
    });

    // Send initial list of all online users to this socket
    socket.emit('online-users', Array.from(userSockets.keys()));

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Join all user's chat rooms
    Chat.find({ participants: socket.user._id })
      .then(chats => {
        chats.forEach(chat => {
          socket.join(`chat:${chat._id}`);
        });
      })
      .catch(err => console.error('Error joining chat rooms:', err.message));

    // Handle joining a new chat room dynamically
    socket.on('join-chat', (chatId) => {
      socket.join(`chat:${chatId}`);
    });

    // ==========================================
    // 💬 REAL-TIME MESSAGING
    // ==========================================

    socket.on('send-message', async (data) => {
      try {
        const {
          chatId,
          content,
          messageType = 'text',
          replyTo,
          fileUrl,
          fileName,
          fileSize,
          voiceMessage,
          voiceDuration,
          clientTempId,
        } = data;

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.some(p => p.toString() === userId)) {
          return socket.emit('error', { message: 'Unauthorized or chat not found' });
        }

        // Idempotency check: If a message with this clientTempId was already processed, don't duplicate
        if (clientTempId) {
          const existing = await Message.findOne({ chatId, clientTempId })
            .populate('sender', 'username email avatar')
            .populate('replyTo');
          if (existing) {
            io.to(`chat:${chatId}`).emit('new-message', existing);
            return socket.emit('message-sent', existing);
          }
        }

        const message = new Message({
          chatId,
          sender: socket.user._id,
          content: content || (messageType === 'voice' ? '🎤 Voice message' : '📎 Attachment'),
          messageType,
          replyTo: replyTo || null,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          fileSize: fileSize || null,
          voiceMessage: voiceMessage || null,
          voiceDuration: voiceDuration || null,
          clientTempId: clientTempId || null,
        });

        await message.save();

        chat.lastMessage = message._id;
        chat.lastMessageTime = new Date();
        await chat.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username email avatar')
          .populate('replyTo');

        // Broadcast to everyone in chat room
        io.to(`chat:${chatId}`).emit('new-message', populatedMessage);

        // Acknowledge back to sender
        socket.emit('message-sent', populatedMessage);
      } catch (error) {
        console.error('send-message error:', error.message);
        socket.emit('error', { message: error.message });
      }
    });

    // Typing Indicator
    socket.on('typing', ({ chatId, isTyping }) => {
      socket.to(`chat:${chatId}`).emit('user-typing', {
        chatId,
        userId: socket.user._id,
        username: socket.user.username,
        isTyping,
      });
    });

    // Mark as read
    socket.on('mark-read', async ({ messageId, chatId }) => {
      try {
        if (messageId) {
          await Message.findByIdAndUpdate(messageId, {
            $addToSet: { readBy: socket.user._id },
          });

          io.to(`chat:${chatId}`).emit('message-read', {
            messageId,
            chatId,
            userId: socket.user._id,
          });
        } else if (chatId) {
          await Message.updateMany(
            { chatId, readBy: { $ne: socket.user._id } },
            { $addToSet: { readBy: socket.user._id } }
          );

          io.to(`chat:${chatId}`).emit('chat-read', {
            chatId,
            userId: socket.user._id,
          });
        }
      } catch (error) {
        console.error('mark-read socket error:', error.message);
      }
    });

    // Message reaction
    socket.on('message-reaction', async ({ messageId, reaction, chatId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const existingIndex = message.reactions.findIndex(
          r => r.userId.toString() === userId
        );

        if (existingIndex > -1) {
          if (message.reactions[existingIndex].reaction === reaction) {
            message.reactions.splice(existingIndex, 1);
          } else {
            message.reactions[existingIndex].reaction = reaction;
          }
        } else {
          message.reactions.push({ userId: socket.user._id, reaction });
        }

        await message.save();

        io.to(`chat:${chatId}`).emit('reaction-updated', {
          messageId,
          reactions: message.reactions,
          userId,
        });
      } catch (error) {
        console.error('message-reaction error:', error.message);
      }
    });

    // Delete message event
    socket.on('delete-message', async ({ messageId, chatId, deleteType }) => {
      try {
        if (deleteType === 'everyone') {
          io.to(`chat:${chatId}`).emit('message-deleted', {
            messageId,
            chatId,
            deleteType: 'everyone',
          });
        }
      } catch (error) {
        console.error('delete-message socket error:', error.message);
      }
    });

    // ==========================================
    // 📞 WEBRTC VOICE & VIDEO CALL SIGNALING
    // ==========================================

    // 1. Initiate Call
    socket.on('call-user', (data) => {
      const { userToCall, signalData, callType = 'voice' } = data;
      if (!userToCall) return;
      const targetUserId = userToCall.toString();

      console.log(`📞 Call initiated by ${socket.user.username} to user ${targetUserId} (${callType})`);

      // Check if recipient is online in userSockets or room
      const recipientSockets = userSockets.get(targetUserId);
      const isOnline =
        (recipientSockets && recipientSockets.size > 0) ||
        (io.sockets.adapter.rooms.get(`user:${targetUserId}`)?.size > 0);

      if (!isOnline) {
        // Recipient is offline, log missed call
        Call.create({
          caller: socket.user._id,
          receiver: userToCall,
          callType,
          status: 'missed',
          duration: 0,
        }).catch(() => {});

        return socket.emit('call-failed', {
          reason: 'offline',
          message: 'Contact is currently offline.',
        });
      }

      // Track active call
      activeCalls.set(userId, { withUser: targetUserId, callType });

      // Relay incoming call to user's room
      io.to(`user:${targetUserId}`).emit('incoming-call', {
        signal: signalData,
        from: userId,
        caller: {
          _id: socket.user._id,
          username: socket.user.username,
          avatar: socket.user.avatar,
        },
        callType,
      });
    });

    // 2. Accept Call
    socket.on('answer-call', (data) => {
      const { signal, to, callType = 'voice' } = data;
      if (!to) return;
      const targetUserId = to.toString();

      console.log(`✅ Call answered by ${socket.user.username} for user ${targetUserId}`);

      activeCalls.set(userId, { withUser: targetUserId, callType });

      // Relay call-accepted to caller's room
      io.to(`user:${targetUserId}`).emit('call-accepted', {
        signal,
        from: userId,
        callType,
      });
    });

    // 3. ICE Candidate Relay
    socket.on('ice-candidate', (data) => {
      const { to, candidate } = data;
      if (!to || !candidate) return;
      const targetUserId = to.toString();

      io.to(`user:${targetUserId}`).emit('ice-candidate', {
        candidate,
        from: userId,
      });
    });

    // 4. Reject Call
    socket.on('reject-call', (data) => {
      const { to, callType = 'voice' } = data;
      if (!to) return;
      const targetUserId = to.toString();

      console.log(`❌ Call rejected between ${userId} and ${targetUserId}`);

      activeCalls.delete(targetUserId);
      activeCalls.delete(userId);

      // Log rejected call
      Call.create({
        caller: to,
        receiver: socket.user._id,
        callType,
        status: 'rejected',
        duration: 0,
      }).catch(() => {});

      io.to(`user:${targetUserId}`).emit('call-rejected', {
        message: 'Call was declined',
        from: userId,
      });
    });

    // 5. End Call
    socket.on('end-call', (data) => {
      const { to, duration = 0, callType = 'voice' } = data;
      const targetUserId = to ? to.toString() : null;

      console.log(`🛑 Call ended by ${socket.user.username}, duration: ${duration}s`);

      activeCalls.delete(userId);
      if (targetUserId) {
        activeCalls.delete(targetUserId);

        // Log completed call
        Call.create({
          caller: socket.user._id,
          receiver: to,
          callType,
          status: duration > 0 ? 'completed' : 'missed',
          duration,
        }).catch(() => {});

        io.to(`user:${targetUserId}`).emit('call-ended', {
          duration,
          from: userId,
        });
      }
    });

    // ==========================================
    // 🚪 DISCONNECTION
    // ==========================================
    socket.on('disconnect', async () => {
      console.log(`🔌 User disconnected: ${socket.user.username} (${socket.id})`);

      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);

          // If was in an active call, notify peer
          if (activeCalls.has(userId)) {
            const callInfo = activeCalls.get(userId);
            activeCalls.delete(userId);
            if (callInfo?.withUser) {
              activeCalls.delete(callInfo.withUser);
              io.to(`user:${callInfo.withUser}`).emit('call-ended', { duration: 0 });
            }
          }

          // Update user status to offline
          await User.findByIdAndUpdate(socket.user._id, {
            status: 'offline',
            lastSeen: new Date(),
          });

          io.emit('user-status', {
            userId: socket.user._id,
            status: 'offline',
            lastSeen: new Date(),
          });
        }
      }
    });
  });
};