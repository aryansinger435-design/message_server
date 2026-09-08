import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  name: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    enum: ['private', 'group'],
    default: 'private',
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  admin: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  avatar: {
    type: String,
    default: null,
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  lastMessageTime: {
    type: Date,
    default: Date.now,
  },
  pinned: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  muted: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    until: {
      type: Date,
    },
  }],
}, {
  timestamps: true,
});

// Indexes
chatSchema.index({ participants: 1 });
chatSchema.index({ lastMessageTime: -1 });

export const Chat = mongoose.model('Chat', chatSchema);
export default Chat;