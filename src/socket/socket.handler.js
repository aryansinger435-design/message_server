import { User } from '../models/User.model.js';
import { Message } from '../models/Message.model.js';
import { Chat } from '../models/Chat.model.js';
import jwt from 'jsonwebtoken';

const userSockets = new Map();

export const initializeSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId).select('-password');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username}`);

    // Store user socket
    userSockets.set(socket.user._id.toString(), socket.id);

    // Update user status
    User.findByIdAndUpdate(socket.user._id, {
      status: 'online',
      lastSeen: new Date(),
    }).then(() => {
      io.emit('user-status', {
        userId: socket.user._id,
        status: 'online',
      });
    });

    // Join user's personal room
    socket.join(`user:${socket.user._id}`);

    // Join all user's chat rooms
    Chat.find({ participants: socket.user._id }).then(chats => {
      chats.forEach(chat => {
        socket.join(`chat:${chat._id}`);
      });
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        const { chatId, content, messageType = 'text', replyTo } = data;

        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.includes(socket.user._id)) {
          return socket.emit('error', { message: 'Unauthorized' });
        }

        const message = new Message({
          chatId,
          sender: socket.user._id,
          content,
          messageType,
          replyTo: replyTo || null,
        });

        await message.save();

        chat.lastMessage = message._id;
        chat.lastMessageTime = new Date();
        await chat.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'username email avatar')
          .populate('replyTo');

        // Emit to all participants in chat
        io.to(`chat:${chatId}`).emit('new-message', populatedMessage);

        // Emit to sender for confirmation
        socket.emit('message-sent', populatedMessage);

        // Send notifications to other participants
        chat.participants.forEach(participantId => {
          if (participantId.toString() !== socket.user._id.toString()) {
            const participantSocketId = userSockets.get(participantId.toString());
            if (!participantSocketId) {
              // User is offline, handle notification (save to DB, push notification, etc.)
              console.log(`User ${participantId} is offline`);
            }
          }
        });

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ chatId, isTyping }) => {
      socket.to(`chat:${chatId}`).emit('user-typing', {
        userId: socket.user._id,
        username: socket.user.username,
        isTyping,
      });
    });

    // Handle mark as read
    socket.on('mark-read', async ({ messageId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: { readBy: socket.user._id },
        });

        const message = await Message.findById(messageId);
        if (message) {
          io.to(`chat:${message.chatId}`).emit('message-read', {
            messageId,
            userId: socket.user._id,
          });
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.user.username}`);
      
      userSockets.delete(socket.user._id.toString());

      await User.findByIdAndUpdate(socket.user._id, {
        status: 'offline',
        lastSeen: new Date(),
      });

      io.emit('user-status', {
        userId: socket.user._id,
        status: 'offline',
        lastSeen: new Date(),
      });
    });
  });
};