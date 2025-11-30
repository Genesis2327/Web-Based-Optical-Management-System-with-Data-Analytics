const { Server } = require('socket.io');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// Configure CORS for your frontend (allow network IPs)
// Get allowed origins from environment or use defaults
const getAllowedOrigins = () => {
  const envOrigins = process.env.CORS_ORIGINS;
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  // Default origins - include common development ports
  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
  ];
  
  // Add network IP if available
  const networkIP = process.env.NETWORK_IP || '192.168.100.6';
  defaultOrigins.push(`http://${networkIP}:5173`);
  defaultOrigins.push(`http://${networkIP}:3000`);
  
  return defaultOrigins;
};

const allowedOrigins = getAllowedOrigins();

// Configure CORS for your frontend
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // In development, be more permissive
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[WebSocket] Allowing origin in dev mode: ${origin}`);
          callback(null, true);
        } else {
          console.warn(`[WebSocket] Blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Allow Engine.IO v3 clients
});

// Middleware to authenticate socket connections
io.use((socket, next) => {
  // Accept token from auth payload or Authorization header
  let token = socket.handshake?.auth?.token || socket.handshake?.headers?.authorization || '';

  // Strip Bearer prefix if present
  if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  // Skip authentication if SKIP_WS_AUTH is explicitly set to 'true'
  if (process.env.SKIP_WS_AUTH === 'true') {
    socket.userId = 'dev-user';
    socket.userRole = 'admin'; // Default to admin for development
    socket.userBranchId = null;
    return next();
  }

  // In development mode, be more lenient but still try to verify token if provided
  if (process.env.NODE_ENV !== 'production' && !token) {
    // No token in dev mode - allow connection with default user
    socket.userId = 'dev-user';
    socket.userRole = 'admin';
    socket.userBranchId = null;
    return next();
  }

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  try {
    // Verify JWT token (prefer JWT_SECRET, fallback to APP_KEY)
    const secret = process.env.JWT_SECRET || process.env.APP_KEY || 'your-app-key';
    const decoded = jwt.verify(token, secret);
    socket.userId = decoded.sub || decoded.user_id || decoded.id || 'unknown';
    socket.userRole = decoded.role || 'user';
    socket.userBranchId = decoded.branch_id || null;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Store active connections
const activeConnections = new Map();

io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected with role ${socket.userRole}`);
  
  // Store connection info
  activeConnections.set(socket.userId, {
    socketId: socket.id,
    role: socket.userRole,
    branchId: socket.userBranchId,
    connectedAt: new Date(),
  });

  // Handle joining channels
  socket.on('join', (channel) => {
    socket.join(channel);
    console.log(`User ${socket.userId} joined channel ${channel}`);
  });

  // Handle leaving channels
  socket.on('leave', (channel) => {
    socket.leave(channel);
    console.log(`User ${socket.userId} left channel ${channel}`);
  });

  // Handle custom events
  socket.on('custom-event', (data) => {
    console.log(`Custom event from user ${socket.userId}:`, data);
    // Broadcast to appropriate channels based on data
    if (data.type === 'appointment') {
      socket.to(`branch.${data.branchId}`).emit('appointment-update', data);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.userId} disconnected: ${reason}`);
    activeConnections.delete(socket.userId);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error(`Socket error for user ${socket.userId}:`, error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    connections: activeConnections.size,
    uptime: process.uptime(),
  });
});

// Get active connections info
app.get('/connections', (req, res) => {
  const connections = Array.from(activeConnections.entries()).map(([userId, info]) => ({
    userId,
    ...info,
  }));
  
  res.json({
    total: activeConnections.size,
    connections,
  });
});

// Set default development bypass
process.env.SKIP_WS_AUTH = process.env.SKIP_WS_AUTH || (process.env.NODE_ENV === 'development' ? 'true' : 'false');

const PORT = process.env.WEBSOCKET_PORT || 6001;
const HOST = process.env.WEBSOCKET_HOST || '0.0.0.0'; // Listen on all interfaces for network access

server.listen(PORT, HOST, () => {
  console.log(`WebSocket server running on ${HOST}:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Connections info: http://localhost:${PORT}/connections`);
  console.log(`Network access: ws://192.168.100.6:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
