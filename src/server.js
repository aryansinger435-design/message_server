import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import chatRoutes from './routes/chat.routes.js';
import messageRoutes from './routes/message.routes.js';
import statusRoutes from './routes/status.routes.js';
import callRoutes from './routes/call.routes.js';
import { initializeSocket } from './socket/socket.handler.js';

// Global Exception & Rejection Handlers to prevent unexpected server crashes
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Clean up multiple leading slashes (e.g. //api -> /api)
app.use((req, res, next) => {
  if (req.url.startsWith('//')) {
    req.url = req.url.replace(/^\/+/, '/');
  }
  next();
});

// Universal CORS configuration & Preflight handler
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint (Instant response, no DB required)
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'online',
    appName: 'AuraWave Backend',
    timestamp: new Date().toISOString(),
  });
});

// Database Connection with Realtime Terminal Logging & Serverless support
let isConnected = false;

// Setup Mongoose connection lifecycle event listeners
mongoose.connection.on('connected', () => {
  const host = mongoose.connection.host || 'unknown';
  const name = mongoose.connection.name || 'default';
  console.log(`🍃 Mongoose Connection Established -> Database: [${name}] on Host: [${host}]`);
});

mongoose.connection.on('error', (err) => {
  console.error(`❌ Mongoose Connection Error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose Disconnected from MongoDB');
  isConnected = false;
});

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const rawUri = process.env.mongodburl || process.env.MONGODB_URI;
  const mongoUri = rawUri ? rawUri.trim() : '';

  if (!mongoUri) {
    console.error('❌ MONGODB_URI or mongodburl not found in .env');
    return;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
    isConnected = true;

    // Mask credentials for secure display in terminal
    const sanitizedUri = mongoUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.+)/, '$1******$2');

    console.log('🍃 ========================================================');
    console.log('🍃 ✅ MongoDB / Mongoose Connected Successfully!');
    console.log(`🍃 Database Name : ${conn.connection.name}`);
    console.log(`🍃 Host          : ${conn.connection.host}`);
    console.log(`🍃 MongoDB URL   : ${sanitizedUri}`);
    console.log(`🍃 Ready State   : ${conn.connection.readyState} (1 = Connected)`);
    console.log('🍃 ========================================================');

    return conn;
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
  }
};

// Immediately initiate DB connection on startup
connectDB();

// Middleware to ensure DB connection on serverless / cold-start calls
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  next();
});

// Serve local media uploads statically
const staticUploadsDir = process.env.VERCEL
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(staticUploadsDir));

// Mount API routes (supports both /api/path and /path when Vercel rewrites)
const mountRoutes = (prefix) => {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/users`, userRoutes);
  app.use(`${prefix}/chats`, chatRoutes);
  app.use(`${prefix}/messages`, messageRoutes);
  app.use(`${prefix}/status`, statusRoutes);
  app.use(`${prefix}/calls`, callRoutes);
};

mountRoutes('/api');
mountRoutes('');

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    console.error('Server error:', err);
  } else {
    console.log(`🔒 [${statusCode}] ${req.method} ${req.originalUrl || req.url}: ${err.message}`);
  }
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Something went wrong!',
    errors: err.errors || null,
  });
});

// Setup Socket.io & HTTP Listen for non-serverless environments
if (!process.env.VERCEL) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  initializeSocket(io);

  const PORT = process.env.PORT || 5000;

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Please wait a moment or terminate the existing process.`);
    } else {
      console.error('❌ HTTP Server Error:', err.message);
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 AuraWave Server running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server initialized`);
  });

  // Graceful shutdown handlers for nodemon restarts and termination signals
  const gracefulExit = () => {
    httpServer.close(() => {
      mongoose.connection.close(false).finally(() => {
        process.exit(0);
      });
    });
  };

  process.once('SIGUSR2', () => {
    httpServer.close(() => {
      process.kill(process.pid, 'SIGUSR2');
    });
  });
  process.on('SIGINT', gracefulExit);
  process.on('SIGTERM', gracefulExit);
}

export default app;