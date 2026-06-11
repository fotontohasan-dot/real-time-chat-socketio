const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory storage for development
const messages = new Map(); // userId -> array of messages

const users = new Map(); // socket.id -> user info

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (data) => {
    const { userId, role } = data;
    users.set(socket.id, { userId, role });

    if (role === 'admin') {
      socket.join('admin-room');
    } else {
      socket.join(`user-${userId}`);
    }

    // Send previous messages
    if (messages.has(userId)) {
      socket.emit('previous-messages', messages.get(userId));
    }

    console.log(`${role} ${userId} joined`);
  });

  socket.on('send-message', (data) => {
    const { userId, message, role } = data;
    const msg = {
      id: Date.now().toString(),
      userId,
      senderRole: role,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };

    if (!messages.has(userId)) {
      messages.set(userId, []);
    }
    messages.get(userId).push(msg);

    // Send to user
    io.to(`user-${userId}`).emit('new-message', msg);

    // Send to admin
    io.to('admin-room').emit('new-message', msg);
  });

  socket.on('typing', (data) => {
    const { userId, role } = data;
    if (role === 'user') {
      socket.to('admin-room').emit('user-typing', { userId });
    } else {
      socket.to(`user-${userId}`).emit('user-typing', { userId });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    users.delete(socket.id);
  });
});

// REST endpoint
app.get('/api/messages/:userId', (req, res) => {
  const userMessages = messages.get(req.params.userId) || [];
  res.json(userMessages);
});

app.get('/api/users', (req, res) => {
  // For admin to see active users
  res.json(Array.from(messages.keys()));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
