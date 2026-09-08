import { Chat } from '../models/Chat.model.js';
import { Message } from '../models/Message.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';

export const createChat = async (req, res, next) => {
  try {
    const { participants, name, type = 'private' } = req.body;
    
    if (!participants || participants.length === 0) {
      throw new ApiError(400, 'At least one participant required');
    }
    
    // Add current user if not included
    let allParticipants = participants;
    if (!participants.includes(req.user._id.toString())) {
      allParticipants = [...participants, req.user._id.toString()];
    }
    
    // Check if private chat already exists
    if (type === 'private' && allParticipants.length === 2) {
      const existingChat = await Chat.findOne({
        type: 'private',
        participants: { $all: allParticipants, $size: 2 },
      });
      
      if (existingChat) {
        const populatedExistingChat = await Chat.findById(existingChat._id)
          .populate('participants', 'username email avatar status lastSeen')
          .populate('admin', 'username email avatar')
          .populate('lastMessage');
        return res.status(200).json({
          success: true,
          data: populatedExistingChat,
        });
      }
    }
    
    const chat = new Chat({
      name: type === 'private' ? null : name,
      type,
      participants: allParticipants,
      admin: type === 'group' ? [req.user._id] : [],
    });
    
    await chat.save();
    
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'username email avatar status lastSeen')
      .populate('admin', 'username email avatar');
    
    res.status(201).json({
      success: true,
      data: populatedChat,
    });
  } catch (error) {
    next(error);
  }
};

export const getChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
    })
      .populate('participants', 'username email avatar status lastSeen')
      .populate('admin', 'username email avatar')
      .populate('lastMessage')
      .sort({ lastMessageTime: -1 });
    
    res.status(200).json({
      success: true,
      data: chats,
    });
  } catch (error) {
    next(error);
  }
};

export const getChatById = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'username email avatar status lastSeen')
      .populate('admin', 'username email avatar')
      .populate('lastMessage');
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    if (!chat.participants.some(p => p._id.toString() === req.user._id.toString())) {
      throw new ApiError(403, 'Access denied');
    }
    
    res.status(200).json({
      success: true,
      data: chat,
    });
  } catch (error) {
    next(error);
  }
};

export const updateChat = async (req, res, next) => {
  try {
    const { name, avatar } = req.body;
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    // Only admin can update group chat
    if (chat.type === 'group' && !chat.admin.includes(req.user._id)) {
      throw new ApiError(403, 'Only admin can update group chat');
    }
    
    const updatedChat = await Chat.findByIdAndUpdate(
      req.params.id,
      { name, avatar },
      { new: true, runValidators: true }
    )
      .populate('participants', 'username email avatar status lastSeen')
      .populate('admin', 'username email avatar');
    
    res.status(200).json({
      success: true,
      data: updatedChat,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    // Only admin can delete group chat
    if (chat.type === 'group' && !chat.admin.includes(req.user._id)) {
      throw new ApiError(403, 'Only admin can delete group chat');
    }
    
    // Delete all messages in chat
    await Message.deleteMany({ chatId: chat._id });
    await chat.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const addParticipants = async (req, res, next) => {
  try {
    const { userIds } = req.body;
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    if (chat.type !== 'group') {
      throw new ApiError(400, 'Only group chats can have participants added');
    }
    
    if (!chat.admin.includes(req.user._id)) {
      throw new ApiError(403, 'Only admin can add participants');
    }
    
    const newParticipants = userIds.filter(
      id => !chat.participants.includes(id)
    );
    
    chat.participants.push(...newParticipants);
    await chat.save();
    
    const updatedChat = await Chat.findById(chat._id)
      .populate('participants', 'username email avatar status lastSeen')
      .populate('admin', 'username email avatar');
    
    res.status(200).json({
      success: true,
      data: updatedChat,
    });
  } catch (error) {
    next(error);
  }
};

export const removeParticipants = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    if (chat.type !== 'group') {
      throw new ApiError(400, 'Only group chats can have participants removed');
    }
    
    if (!chat.admin.includes(req.user._id) && req.user._id.toString() !== userId) {
      throw new ApiError(403, 'Only admin can remove participants');
    }
    
    chat.participants = chat.participants.filter(id => id.toString() !== userId);
    chat.admin = chat.admin.filter(id => id.toString() !== userId);
    await chat.save();
    
    res.status(200).json({
      success: true,
      message: 'Participant removed',
    });
  } catch (error) {
    next(error);
  }
};

export const muteChat = async (req, res, next) => {
  try {
    const { duration } = req.body; // duration in hours
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    const muteUntil = new Date();
    muteUntil.setHours(muteUntil.getHours() + (duration || 24));
    
    const existingMute = chat.muted.find(
      m => m.userId.toString() === req.user._id.toString()
    );
    
    if (existingMute) {
      existingMute.until = muteUntil;
    } else {
      chat.muted.push({ userId: req.user._id, until: muteUntil });
    }
    
    await chat.save();
    
    res.status(200).json({
      success: true,
      message: 'Chat muted',
    });
  } catch (error) {
    next(error);
  }
};

export const unmuteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    chat.muted = chat.muted.filter(
      m => m.userId.toString() !== req.user._id.toString()
    );
    await chat.save();
    
    res.status(200).json({
      success: true,
      message: 'Chat unmuted',
    });
  } catch (error) {
    next(error);
  }
};

export const pinChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    if (!chat.pinned.includes(req.user._id)) {
      chat.pinned.push(req.user._id);
      await chat.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Chat pinned',
    });
  } catch (error) {
    next(error);
  }
};

export const unpinChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      throw new ApiError(404, 'Chat not found');
    }
    
    chat.pinned = chat.pinned.filter(id => id.toString() !== req.user._id.toString());
    await chat.save();
    
    res.status(200).json({
      success: true,
      message: 'Chat unpinned',
    });
  } catch (error) {
    next(error);
  }
};

export const getChatMessages = async (req, res, next) => {
  try {
    const chatId = req.params.id;
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
      .populate('replyTo');
    
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