const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

dotenv.config();

const { seedDatabase } = require('./seed/seedData');
const { setupProctorSocket } = require('./socket/proctorSocket');

const authRoutes = require('./routes/auth');
const examsRoutes = require('./routes/exams');
const attemptsRoutes = require('./routes/attempts');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// CORS configuration supporting cross-domain frontend deployments (e.g. Render, Vercel)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : '*';

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server, mobile)
    if (!origin || allowedOrigins === '*' || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(null, true); // Fallback allows seamless multi-origin Render previews
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle all preflight requests

// Socket.IO configuration with CORS support
const io = new Server(server, {
  cors: {
    origin: allowedOrigins === '*' ? '*' : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true
  }
});

// Attach io to express app so routes can broadcast
app.set('io', io);

// Setup socket listeners
setupProctorSocket(io);

// Parse JSON request payloads
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/attempts', attemptsRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Mock Examination & Security Monitoring Engine',
    timestamp: new Date().toISOString()
  });
});

// Root API information for deployment uptime monitors and Render health checks
app.get('/', (req, res, next) => {
  const rootDistPath = path.resolve(__dirname, '../dist');
  const clientDistPath = fs.existsSync(rootDistPath) ? rootDistPath : path.resolve(__dirname, '../client/dist');
  
  // If static client build is present, serve the frontend index.html
  if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }

  // Otherwise, return API service metadata
  res.json({
    status: 'online',
    service: 'Mock Examination & Security Monitoring Engine Backend API',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/entry',
      exams: '/api/exams',
      attempts: '/api/attempts',
      admin: '/api/admin'
    },
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static build if available (Unified fullstack deployment)
const rootDistPath = path.resolve(__dirname, '../dist');
const clientDistPath = fs.existsSync(rootDistPath) ? rootDistPath : path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  
  // Catch-all route to serve React Single Page Application
  app.get('*', (req, res) => {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(404).json({ error: `API route ${req.originalUrl} not found` });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Bind to process.env.PORT and 0.0.0.0 for cloud hosting (Render, Railway, Fly.io)
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Initialize Database & Start Server
(async () => {
  try {
    await seedDatabase();
    server.listen(PORT, HOST, () => {
      console.log(`=======================================================`);
      console.log(`  MOCK EXAM & MONITORING PLATFORM (COMMAND BRIDGE)     `);
      console.log(`  Server listening on http://${HOST}:${PORT}           `);
      console.log(`  Admins: Tony Stark (Iron Man) & Captain America      `);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
})();

module.exports = { app, server };
