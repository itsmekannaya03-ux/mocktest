const http = require('http');
const express = require('express');
const cors = require('cors');
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

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Attach io to express app so routes can broadcast
app.set('io', io);

// Setup socket listeners
setupProctorSocket(io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/attempts', attemptsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Mock Examination & Security Monitoring Engine',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Database & Start Server
(async () => {
  try {
    await seedDatabase();
    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  MOCK EXAM & MONITORING PLATFORM (COMMAND BRIDGE)     `);
      console.log(`  Server listening on http://localhost:${PORT}        `);
      console.log(`  Admins: Tony Stark (Iron Man) & Captain America      `);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
})();

module.exports = { app, server };
