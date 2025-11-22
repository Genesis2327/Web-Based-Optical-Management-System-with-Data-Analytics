const { Server } = require('socket.io');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

// Configure CORS for your frontend (allow network IPs)
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.100.6:5173', // Network IP
];

// Configure CORS for your frontend
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware to authenticate socket connections
io.use((socket, next) => {
  // Accept token from auth payload or Authorization header
  let token = socket.handshake?.auth?.token || socket.handshake?.headers?.authorization || '';

  // Strip Bearer prefix if present
  if (typeof token === 'string' && token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  // Development mode: skip authentication entirely unless SKIP_WS_AUTH is explicitly false
  if (process.env.NODE_ENV !== 'production' || process.env.SKIP_WS_AUTH === 'true') {
    socket.userId = 'dev-user';
    socket.userRole = 'admin'; // Default to admin for development
    socket.userBranchId = null;
    return next();
  }

  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }

  // Dev bypass flag: skip JWT verification entirely
  if (process.env.SKIP_WS_AUTH === 'true') {
    socket.userId = 'dev-user';
    socket.userRole = 'admin'; // Default to admin for development
    socket.userBranchId = null;
    return next();
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
