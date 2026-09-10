import { Message } from '../models/Message.model.js';
import { Chat } from '../models/Chat.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { uploadMedia } from '../config/cloudinary.js';

export const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }

    let resourceType = 'auto';
    if (req.file.mimetype.startsWith('image/')) resourceType = 'image';
    else if (req.file.mimetype.startsWith('video/')) resourceType = 'video';
    else if (req.file.mimetype.startsWith('audio/')) resourceType = 'video'; // Cloudinary handles audio as video
    else resourceType = 'raw';

    const uploaded = await uploadMedia(req.file.buffer, {
      folder: 'aurawave_attachments',
      resourceType,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    res.status(200).json({
      success: true,
      data: {
        fileUrl: uploaded.url,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
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
    } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }

    if (!chat.participants.some(p => p.toString() === userId.toString())) {
      throw new ApiError(403, 'You are not a participant of this chat');
    }

    // Idempotency check: If a message with this clientTempId was already processed, return it
    if (clientTempId) {
      const existing = await Message.findOne({ chatId, clientTempId })
        .populate('sender', 'username email avatar')
        .populate('replyTo');
      if (existing) {
        return res.status(200).json({
          success: true,
          data: existing,
        });
      }
    }

    const message = new Message({
      chatId,
      sender: userId,
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

    // If socket.io is available on the express app, broadcast to everyone in the chat room
    const io = req.app.get('io');
    if (io) {
      io.to(`chat:${chatId}`).emit('new-message', populatedMessage);
    }

    res.status(201).json({
      success: true,
      data: populatedMessage,
    });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 100 } = req.query;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }

    if (!chat.participants.some(p => p.toString() === req.user._id.toString())) {
      throw new ApiError(403, 'Access denied');
    }

    const messages = await Message.find({
      chatId,
      deletedBy: { $ne: req.user._id },
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sender', 'username email avatar')
      .populate('replyTo')
      .lean();

    const total = await Message.countDocuments({
      chatId,
      deletedBy: { $ne: req.user._id },
    });

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      throw new ApiError(404, 'Message not found');
    }

    if (!message.readBy.some(id => id.toString() === userId.toString())) {
      message.readBy.push(userId);
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      { chatId, readBy: { $ne: userId } },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({
      success: true,
      message: 'All messages marked as read',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { deleteType = 'everyone' } = req.body; // 'everyone' or 'me'
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      throw new ApiError(404, 'Message not found');
    }

    if (deleteType === 'everyone') {
      if (message.sender.toString() !== userId.toString()) {
        throw new ApiError(403, 'You can only delete your own messages for everyone');
      }
      message.isDeletedForEveryone = true;
      message.content = '🚫 This message was deleted';
      message.fileUrl = null;
      message.voiceMessage = null;
      await message.save();
    } else {
      // Delete for me
      if (!message.deletedBy.some(id => id.toString() === userId.toString())) {
        message.deletedBy.push(userId);
        await message.save();
      }
    }

    res.status(200).json({
      success: true,
      message: deleteType === 'everyone' ? 'Deleted for everyone' : 'Deleted for you',
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

export const addReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      throw new ApiError(404, 'Message not found');
    }

    const existingIndex = message.reactions.findIndex(
      r => r.userId.toString() === userId.toString()
    );

    if (existingIndex > -1) {
      if (message.reactions[existingIndex].reaction === reaction) {
        // Toggle off if same reaction clicked
        message.reactions.splice(existingIndex, 1);
      } else {
        message.reactions[existingIndex].reaction = reaction;
      }
    } else {
      message.reactions.push({ userId, reaction });
    }

    await message.save();

    res.status(200).json({
      success: true,
      data: message.reactions,
    });
  } catch (error) {
    next(error);
  }
};