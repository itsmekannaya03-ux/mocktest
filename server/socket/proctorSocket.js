const db = require('../models/db');

function setupProctorSocket(io) {
  io.on('connection', (socket) => {
    // Admin joins the Command Bridge
    socket.on('join_admin_bridge', (adminData) => {
      socket.join('admin_room');
      socket.emit('admin_bridge_connected', {
        status: 'online',
        message: 'Connected to IRIS Security Bridge',
        timestamp: new Date().toISOString()
      });
    });

    // Student joins their dedicated exam session room
    socket.on('join_exam_session', ({ attemptId, userName, badgeId, examTitle }) => {
      if (!attemptId) return;
      socket.join(`attempt_${attemptId}`);
      socket.attemptId = attemptId;
      socket.userName = userName;

      // Broadcast to admins that student is live
      io.to('admin_room').emit('student_online', {
        attemptId,
        userName,
        badgeId,
        examTitle,
        socketId: socket.id,
        timestamp: new Date().toISOString()
      });
    });

    // Heartbeat from exam room (every 5-10s)
    socket.on('exam_heartbeat', (data) => {
      if (!data || !data.attemptId) return;
      io.to('admin_room').emit('student_heartbeat', {
        attemptId: data.attemptId,
        answeredCount: data.answeredCount || 0,
        timeRemainingSeconds: data.timeRemainingSeconds,
        violationsCount: data.violationsCount || 0,
        status: 'active',
        lastPing: new Date().toISOString()
      });
    });

    // Client reports browser violation in real-time
    socket.on('report_violation', (violationData) => {
      io.to('admin_room').emit('violation_alert', {
        ...violationData,
        timestamp: new Date().toISOString()
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (socket.attemptId) {
        io.to('admin_room').emit('student_offline', {
          attemptId: socket.attemptId,
          userName: socket.userName,
          timestamp: new Date().toISOString()
        });
      }
    });
  });
}

module.exports = { setupProctorSocket };
