require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Admin = require('./models/Admin');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Make io globally accessible to routes
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Middleware
const { router: adminRouter } = require('./routes/admin');
app.use('/api/admin', adminRouter);
app.use('/api/verify', require('./routes/verify'));

const usersRouter = require('./routes/users');
const logsRouter = require('./routes/logs');

app.use('/api/users', usersRouter);
app.use('/api/logs', logsRouter);

io.on('connection', (socket) => {
  console.log('Admin Dashboard connected via WebSocket');
});

async function startServer() {
  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Persistent MongoDB Atlas Database!');
  } else {
    const mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    console.log('Connected to In-Memory MongoDB (No MONGO_URI provided in .env)');
  }

  // Seed Default Admin
  const adminExists = await Admin.findOne({ username: 'admin' });
  if (!adminExists) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);
    await Admin.create({ username: 'admin', password_hash: hash });
    console.log('Default Admin Account Created -> User: admin | Pass: admin123');
  }

  const PORT = 5000;
  server.listen(PORT, () => {
    console.log('Backend Server running on http://localhost:' + PORT);
  });
}

startServer().catch(console.error);

