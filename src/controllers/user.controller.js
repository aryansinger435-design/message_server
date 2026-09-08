import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import sharp from 'sharp';
import { uploadMedia } from '../config/cloudinary.js';

export const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password -__v');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('-password -__v')
      .limit(50);
    
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { username, about, phone } = req.body;
    
    // Check if username is taken
    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existingUser) {
        throw new ApiError(409, 'Username already taken');
      }
    }
    
    const updateData = {};
    if (username) updateData.username = username;
    if (about !== undefined) updateData.about = about;
    if (phone !== undefined) updateData.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -__v');
    
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'No file uploaded');
    }
    
    // Process image with sharp
    const processedBuffer = await sharp(req.file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const uploaded = await uploadMedia(processedBuffer, {
      folder: 'aurawave_avatars',
      resourceType: 'image',
      originalname: `${req.user._id}_avatar.jpg`,
    });
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: uploaded.url },
      { new: true }
    ).select('-password -__v');
    
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const getFriends = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username email avatar status lastSeen')
      .select('friends');
    
    res.status(200).json({
      success: true,
      data: user.friends,
    });
  } catch (error) {
    next(error);
  }
};

export const addFriend = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    
    if (friendId === req.user._id.toString()) {
      throw new ApiError(400, 'Cannot add yourself as friend');
    }
    
    const friend = await User.findById(friendId);
    if (!friend) {
      throw new ApiError(404, 'User not found');
    }
    
    const user = await User.findById(req.user._id);
    
    // Check if already friends
    if (user.friends.includes(friendId)) {
      throw new ApiError(400, 'Already friends');
    }
    
    // Check if request already sent
    if (friend.friendRequests.includes(req.user._id)) {
      throw new ApiError(400, 'Friend request already sent');
    }
    
    // Send friend request
    friend.friendRequests.push(req.user._id);
    await friend.save();
    
    res.status(200).json({
      success: true,
      message: 'Friend request sent',
    });
  } catch (error) {
    next(error);
  }
};

export const removeFriend = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    
    const user = await User.findById(req.user._id);
    user.friends = user.friends.filter(id => id.toString() !== friendId);
    await user.save();
    
    const friend = await User.findById(friendId);
    if (friend) {
      friend.friends = friend.friends.filter(id => id.toString() !== req.user._id.toString());
      await friend.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Friend removed',
    });
  } catch (error) {
    next(error);
  }
};

export const getFriendRequests = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests', 'username email avatar');
    
    res.status(200).json({
      success: true,
      data: user.friendRequests,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptFriendRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    
    const user = await User.findById(req.user._id);
    
    if (!user.friendRequests.includes(requestId)) {
      throw new ApiError(400, 'No friend request from this user');
    }
    
    // Add to friends
    user.friends.push(requestId);
    user.friendRequests = user.friendRequests.filter(id => id.toString() !== requestId);
    await user.save();
    
    // Add to other user's friends
    const requester = await User.findById(requestId);
    if (requester) {
      requester.friends.push(req.user._id);
      await requester.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Friend request accepted',
    });
  } catch (error) {
    next(error);
  }
};

export const rejectFriendRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    
    const user = await User.findById(req.user._id);
    user.friendRequests = user.friendRequests.filter(id => id.toString() !== requestId);
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Friend request rejected',
    });
  } catch (error) {
    next(error);
  }
};

export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }
    
    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } },
          ],
        },
      ],
    }).select('-password -__v').limit(20);
    
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};