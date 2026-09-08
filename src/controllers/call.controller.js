import { Call } from '../models/Call.model.js';
import { ApiError } from '../utils/ApiError.js';

export const getCallHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const calls = await Call.find({
      $or: [{ caller: userId }, { receiver: userId }],
    })
      .populate('caller', 'username avatar')
      .populate('receiver', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: calls,
    });
  } catch (error) {
    next(error);
  }
};

export const logCall = async (req, res, next) => {
  try {
    const { receiverId, callType = 'voice', status = 'completed', duration = 0 } = req.body;
    const callerId = req.user._id;

    const call = new Call({
      caller: callerId,
      receiver: receiverId,
      callType,
      status,
      duration,
      startedAt: new Date(Date.now() - duration * 1000),
      endedAt: new Date(),
    });

    await call.save();

    const populated = await Call.findById(call._id)
      .populate('caller', 'username avatar')
      .populate('receiver', 'username avatar');

    res.status(201).json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};
