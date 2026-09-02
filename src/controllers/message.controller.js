import { Message } from '../models/Message.model.js';
import { Chat } from '../models/Chat.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';

export const sendMessage = async (req, res, next) => {
  try {
    const { chatId, content, messageType = 'text', replyTo } = req.body;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }

    // Check if user is participant
    if (!chat.participants.includes(userId)) {
      throw new ApiError(403, 'You are not a participant of this chat');
    }

    const message = new Message({
      chatId,
      sender: userId,
      content,
      messageType,
      replyTo: replyTo || null,
    });

    await message.save();

    // Update chat last message
    chat.lastMessage = message._id;
    chat.lastMessageTime = new Date();
    await chat.save();

    // Populate message
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username email avatar')
      .populate('replyTo');

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
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }

    if (!chat.participants.includes(req.user._id)) {
      throw new ApiError(403, 'Access denied');
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('sender', 'username email avatar')
      .populate('replyTo')
      .lean();

    const total = await Message.countDocuments({ chatId });

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

    if (!message.readBy.includes(userId)) {
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
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      throw new ApiError(404, 'Message not found');
    }

    if (message.sender.toString() !== userId.toString()) {
      throw new ApiError(403, 'You can only delete your own messages');
    }

    await message.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
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

    const existingReaction = message.reactions.find(
      r => r.userId.toString() === userId.toString()
    );

    if (existingReaction) {
      existingReaction.reaction = reaction;
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