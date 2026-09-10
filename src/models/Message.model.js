import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: function() {
      return !this.fileUrl && !this.voiceMessage;
    },
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'voice'],
    default: 'text',
  },
  fileUrl: {
    type: String,
    default: null,
  },
  fileName: {
    type: String,
    default: null,
  },
  fileSize: {
    type: Number,
    default: null,
  },
  voiceMessage: {
    type: String, // URL to voice file
    default: null,
  },
  voiceDuration: {
    type: Number,
    default: null,
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reaction: {
      type: String,
      trim: true,
    },
  }],
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  deliveredTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  isEdited: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null,
  },
  isDeletedForEveryone: {
    type: Boolean,
    default: false,
  },
  deletedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  clientTempId: {
    type: String,
    default: null,
    index: true,
  },
}, {
  timestamps: true,
});

// Indexes for performance
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ chatId: 1, clientTempId: 1 });

export const Message = mongoose.model('Message', messageSchema);
export default Message;