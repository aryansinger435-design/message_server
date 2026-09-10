import { Status } from '../models/Status.model.js';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { uploadMedia } from '../config/cloudinary.js';

export const createStatus = async (req, res, next) => {
  try {
    const { type = 'text', content, caption = '', backgroundColor = '#075E54' } = req.body;
    let finalContent = content;

    if (req.file) {
      const isVideo = req.file.mimetype.startsWith('video/');
      const uploaded = await uploadMedia(req.file.buffer, {
        folder: 'aurawave_status',
        resourceType: isVideo ? 'video' : 'image',
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      });
      finalContent = uploaded.url;
    }

    if (!finalContent || !finalContent.trim()) {
      throw new ApiError(400, 'Status content or media file is required');
    }

    const status = new Status({
      user: req.user._id,
      type: req.file ? (req.file.mimetype.startsWith('video/') ? 'video' : 'image') : (type || 'text'),
      content: finalContent.trim(),
      caption: (caption || '').trim(),
      backgroundColor: backgroundColor || '#075E54',
    });

    await status.save();

    const populated = await Status.findById(status._id).populate('user', 'username avatar');

    const io = req.app.get('io');
    if (io) {
      io.emit('new-status', populated);
    }

    res.status(201).json({
      success: true,
      message: 'Status created successfully',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const getRecentStatuses = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const allRecentStatuses = await Status.find({
      user: { $ne: currentUserId },
      createdAt: { $gte: oneDayAgo },
    })
      .populate('user', 'username avatar')
      .populate('viewers.user', 'username avatar')
      .sort({ createdAt: -1 })
      .lean();

    // Group by user
    const userMap = new Map();

    for (const status of allRecentStatuses) {
      if (!status.user) continue;
      const uId = status.user._id ? status.user._id.toString() : status.user.toString();

      if (!userMap.has(uId)) {
        userMap.set(uId, {
          user: status.user,
          statuses: [],
          allViewed: true,
          latestStatusTime: status.createdAt,
        });
      }

      const group = userMap.get(uId);
      const isViewed = (status.viewers || []).some((v) => {
        const viewerId = v.user?._id ? v.user._id.toString() : (v.user ? v.user.toString() : '');
        return viewerId && viewerId === currentUserId.toString();
      });

      if (!isViewed) {
        group.allViewed = false;
      }

      group.statuses.push({
        _id: status._id,
        type: status.type,
        content: status.content,
        caption: status.caption,
        backgroundColor: status.backgroundColor,
        createdAt: status.createdAt,
        viewers: status.viewers,
        isViewed,
      });
    }

    res.status(200).json({
      success: true,
      data: Array.from(userMap.values()),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyStatuses = async (req, res, next) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const statuses = await Status.find({
      user: req.user._id,
      createdAt: { $gte: oneDayAgo },
    })
      .populate('viewers.user', 'username avatar lastSeen')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: statuses,
    });
  } catch (error) {
    next(error);
  }
};

export const viewStatus = async (req, res, next) => {
  try {
    const { statusId } = req.params;
    const currentUserId = req.user._id;

    const status = await Status.findById(statusId);
    if (!status) {
      throw new ApiError(404, 'Status not found');
    }

    const alreadyViewed = status.viewers.some(
      v => v.user.toString() === currentUserId.toString()
    );

    if (!alreadyViewed) {
      status.viewers.push({
        user: currentUserId,
        viewedAt: new Date(),
      });
      await status.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('status-viewed', { statusId, userId: currentUserId });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Status viewed',
      viewersCount: status.viewers.length,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStatus = async (req, res, next) => {
  try {
    const { statusId } = req.params;
    const status = await Status.findById(statusId);

    if (!status) {
      throw new ApiError(404, 'Status not found');
    }

    if (status.user.toString() !== req.user._id.toString()) {
      throw new ApiError(403, 'You can only delete your own status');
    }

    await status.deleteOne();

    const io = req.app.get('io');
    if (io) {
      io.emit('new-status', { deletedId: statusId });
    }

    res.status(200).json({
      success: true,
      message: 'Status deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
