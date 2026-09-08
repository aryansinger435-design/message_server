import mongoose from 'mongoose';

const statusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video'],
      default: 'text',
    },
    content: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      default: '',
    },
    backgroundColor: {
      type: String,
      default: '#075E54', // WhatsApp classic green/teal default
    },
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // 24 hours expiry (86400 seconds)
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400,
    },
  },
  {
    timestamps: true,
  }
);

statusSchema.index({ user: 1, createdAt: -1 });

export const Status = mongoose.model('Status', statusSchema);
export default Status;
