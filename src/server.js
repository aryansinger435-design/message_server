import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import chatRoutes from './routes/chat.routes.js';
import messageRoutes from './routes/message.routes.js';
import statusRoutes from './routes/status.routes.js';
import callRoutes from './routes/call.routes.js';
import { initializeSocket } from './socket/socket.handler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Configure CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || true) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve local media uploads statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/calls', callRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    appName: 'AuraWave Backend',
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong!',
    errors: err.errors || null,
  });
});

// Setup Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

initializeSocket(io);

// Database Connection
const mongoUri = process.env.MONGODB_URI || process.env.mongodburl;
if (!mongoUri) {
  console.error('❌ MONGODB_URI or mongodburl not found in .env');
} else if (mongoose.connection.readyState === 0) {
  mongoose
    .connect(mongoUri)
    .then(() => console.log('🍃 MongoDB connected successfully'))
    .catch((err) => console.error('❌ MongoDB connection error:', err.message));
}

const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 AuraWave Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server initialized`);
  });
}

export default app;