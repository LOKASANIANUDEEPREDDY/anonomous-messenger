const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected users with their anonymous IDs
const connectedUsers = new Map();
let userCounter = 1000;
let autoClearTimer = null;
let lastMessageTime = null;

// Generate random anonymous user ID
function generateAnonymousId() {
  return Math.floor(Math.random() * 9000) + 1000;
}

// Auto-clear messages every 5 minutes
function startAutoClearTimer() {
  if (autoClearTimer) {
    clearInterval(autoClearTimer);
  }
  
  autoClearTimer = setInterval(() => {
    console.log('Auto-clearing messages (5 minute interval)');
    io.emit('clear messages');
  }, 5 * 60 * 1000); // 5 minutes
}

io.on('connection', (socket) => {
  // Assign anonymous ID to new user
  const anonymousId = generateAnonymousId();
  connectedUsers.set(socket.id, anonymousId);
  
  console.log(`Anonymous User #${anonymousId} connected (${socket.id})`);
  
  // Broadcast user count to all clients
  io.emit('user count', connectedUsers.size);
  
  // Send welcome message to the user
  socket.emit('welcome', {
    anonymousId: anonymousId,
    message: 'Welcome to Anonymous Messenger!'
  });
  
  // Notify others that someone joined
  socket.broadcast.emit('user joined', {
    message: 'A new user joined the chat',
    userCount: connectedUsers.size
  });

  // Handle incoming messages
  socket.on('chat message', (msg) => {
    const userAnonymousId = connectedUsers.get(socket.id);
    const messageData = {
      id: Date.now(),
      text: msg,
      sender: `Anonymous #${userAnonymousId}`,
      timestamp: new Date().toLocaleTimeString()
    };
    
    // Start auto-clear timer on first message
    if (!lastMessageTime) {
      lastMessageTime = Date.now();
      startAutoClearTimer();
      console.log('Started auto-clear timer (5 minutes)');
    }
    
    // Broadcast message to all clients including sender
    io.emit('chat message', messageData);
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    const userAnonymousId = connectedUsers.get(socket.id);
    socket.broadcast.emit('typing', {
      sender: `Anonymous #${userAnonymousId}`,
      isTyping: isTyping
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const userAnonymousId = connectedUsers.get(socket.id);
    console.log(`Anonymous User #${userAnonymousId} disconnected`);
    
    connectedUsers.delete(socket.id);
    
    // Clear messages for all users when someone leaves
    io.emit('clear messages');
    
    // Notify others that someone left
    io.emit('user left', {
      message: 'A user left the chat',
      userCount: connectedUsers.size
    });
    
    io.emit('user count', connectedUsers.size);
    
    // Stop auto-clear timer if no users left
    if (connectedUsers.size === 0) {
      if (autoClearTimer) {
        clearInterval(autoClearTimer);
        autoClearTimer = null;
        lastMessageTime = null;
        console.log('Stopped auto-clear timer (no users)');
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Anonymous Messenger server running on http://localhost:${PORT}`);
});
