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
const privateChats = new Map(); // Track who's in private chat: socketId -> partnerId
const chatRooms = new Map(); // Track rooms: roomId -> { name, creator, members: Set }
let userCounter = 1000;
let roomCounter = 1;
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
  
  // Send updated user list to all clients
  const userList = Array.from(connectedUsers.entries()).map(([socketId, userId]) => ({
    socketId: socketId,
    anonymousId: userId,
    inPrivateChat: privateChats.has(socketId)
  }));
  io.emit('user list', userList);
  
  // Send room list to new user
  const roomList = Array.from(chatRooms.entries()).map(([roomId, room]) => ({
    roomId: roomId,
    name: room.name,
    creator: room.creator,
    memberCount: room.members.size
  }));
  socket.emit('room list', roomList);
  
  // Notify others that someone joined
  socket.broadcast.emit('user joined', {
    message: 'A new user joined the chat',
    userCount: connectedUsers.size
  });

  // Handle private chat request
  socket.on('private chat request', (targetSocketId) => {
    const requesterAnonymousId = connectedUsers.get(socket.id);
    io.to(targetSocketId).emit('private chat request', {
      from: socket.id,
      fromAnonymousId: requesterAnonymousId
    });
  });

  // Handle private chat accept
  socket.on('private chat accept', (data) => {
    const accepterAnonymousId = connectedUsers.get(socket.id);
    
    // Mark both users as in private chat
    privateChats.set(socket.id, data.from);
    privateChats.set(data.from, socket.id);
    
    // Notify both users
    socket.emit('private chat started', {
      with: data.from,
      withAnonymousId: data.fromAnonymousId
    });
    io.to(data.from).emit('private chat started', {
      with: socket.id,
      withAnonymousId: accepterAnonymousId
    });
    
    // Update user list for everyone
    const userList = Array.from(connectedUsers.entries()).map(([socketId, userId]) => ({
      socketId: socketId,
      anonymousId: userId,
      inPrivateChat: privateChats.has(socketId)
    }));
    io.emit('user list', userList);
  });

  // Handle private messages
  socket.on('private message', (data) => {
    const senderAnonymousId = connectedUsers.get(socket.id);
    const messageData = {
      id: Date.now(),
      text: data.message,
      sender: `Anonymous #${senderAnonymousId}`,
      timestamp: new Date().toLocaleTimeString(),
      isPrivate: true
    };
    
    // Send ONLY to recipient (not broadcast to everyone)
    io.to(data.to).emit('private message', messageData);
    // Echo back ONLY to sender
    socket.emit('private message', messageData);
  });

  // Handle return to public chat
  socket.on('leave private chat', (targetSocketId) => {
    // Remove from private chat tracking
    privateChats.delete(socket.id);
    if (targetSocketId) {
      privateChats.delete(targetSocketId);
    }
    
    socket.emit('left private chat');
    if (targetSocketId) {
      io.to(targetSocketId).emit('partner left private chat');
    }
    
    // Update user list for everyone
    const userList = Array.from(connectedUsers.entries()).map(([socketId, userId]) => ({
      socketId: socketId,
      anonymousId: userId,
      inPrivateChat: privateChats.has(socketId)
    }));
    io.emit('user list', userList);
  });

  // Handle room creation
  socket.on('create room', (roomName) => {
    const roomId = `room_${roomCounter++}`;
    const creatorAnonymousId = connectedUsers.get(socket.id);
    
    chatRooms.set(roomId, {
      name: roomName,
      creator: socket.id,
      creatorAnonymousId: creatorAnonymousId,
      members: new Set([socket.id])
    });
    
    socket.join(roomId);
    
    // Notify creator
    socket.emit('room created', {
      roomId: roomId,
      name: roomName
    });
    
    // Broadcast updated room list to everyone
    const roomList = Array.from(chatRooms.entries()).map(([id, room]) => ({
      roomId: id,
      name: room.name,
      creator: room.creatorAnonymousId,
      memberCount: room.members.size
    }));
    io.emit('room list', roomList);
    
    console.log(`Room "${roomName}" created by Anonymous #${creatorAnonymousId}`);
  });

  // Handle room join request
  socket.on('request join room', (data) => {
    const room = chatRooms.get(data.roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    const requesterAnonymousId = connectedUsers.get(socket.id);
    
    // Send request to room creator
    io.to(room.creator).emit('room join request', {
      roomId: data.roomId,
      roomName: room.name,
      from: socket.id,
      fromAnonymousId: requesterAnonymousId
    });
    
    socket.emit('join request sent', room.name);
  });

  // Handle room join accept
  socket.on('accept room join', (data) => {
    const room = chatRooms.get(data.roomId);
    if (!room) return;
    
    // Add user to room
    room.members.add(data.userId);
    
    // Add user to socket room
    const userSocket = io.sockets.sockets.get(data.userId);
    if (userSocket) {
      userSocket.join(data.roomId);
    }
    
    const joinerAnonymousId = connectedUsers.get(data.userId);
    
    // Notify the user they've been accepted
    io.to(data.userId).emit('room joined', {
      roomId: data.roomId,
      name: room.name
    });
    
    // Notify all room members
    io.to(data.roomId).emit('room message', {
      id: Date.now(),
      text: `Anonymous #${joinerAnonymousId} joined the room`,
      sender: 'System',
      timestamp: new Date().toLocaleTimeString(),
      isSystem: true
    });
    
    // Update room list for everyone
    const roomList = Array.from(chatRooms.entries()).map(([id, rm]) => ({
      roomId: id,
      name: rm.name,
      creator: rm.creatorAnonymousId,
      memberCount: rm.members.size
    }));
    io.emit('room list', roomList);
  });

  // Handle room messages
  socket.on('room message', (data) => {
    const room = chatRooms.get(data.roomId);
    if (!room || !room.members.has(socket.id)) {
      return; // User not in room
    }
    
    const senderAnonymousId = connectedUsers.get(socket.id);
    const messageData = {
      id: Date.now(),
      text: data.message,
      sender: `Anonymous #${senderAnonymousId}`,
      timestamp: new Date().toLocaleTimeString(),
      isRoom: true
    };
    
    // Broadcast to all room members
    io.to(data.roomId).emit('room message', messageData);
  });

  // Handle leave room
  socket.on('leave room', (roomId) => {
    const room = chatRooms.get(roomId);
    if (!room) return;
    
    const userAnonymousId = connectedUsers.get(socket.id);
    room.members.delete(socket.id);
    socket.leave(roomId);
    
    // Notify remaining members
    if (room.members.size > 0) {
      io.to(roomId).emit('room message', {
        id: Date.now(),
        text: `Anonymous #${userAnonymousId} left the room`,
        sender: 'System',
        timestamp: new Date().toLocaleTimeString(),
        isSystem: true
      });
    }
    
    // If creator left or room is empty, delete room
    if (socket.id === room.creator || room.members.size === 0) {
      chatRooms.delete(roomId);
      io.to(roomId).emit('room closed');
    }
    
    socket.emit('left room');
    
    // Update room list
    const roomList = Array.from(chatRooms.entries()).map(([id, rm]) => ({
      roomId: id,
      name: rm.name,
      creator: rm.creatorAnonymousId,
      memberCount: rm.members.size
    }));
    io.emit('room list', roomList);
  });

  // Handle incoming messages
  socket.on('chat message', (msg) => {
    const userAnonymousId = connectedUsers.get(socket.id);
    const messageData = {
      id: Date.now(),
      text: msg,
      sender: `Anonymous #${userAnonymousId}`,
      timestamp: new Date().toLocaleTimeString(),
      isPublic: true
    };
    
    // Start auto-clear timer on first message
    if (!lastMessageTime) {
      lastMessageTime = Date.now();
      startAutoClearTimer();
      console.log('Started auto-clear timer (5 minutes)');
    }
    
    // Broadcast message to all clients including sender (only public chat)
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
    
    // If user was in private chat, notify partner
    if (privateChats.has(socket.id)) {
      const partnerId = privateChats.get(socket.id);
      io.to(partnerId).emit('partner left private chat');
      privateChats.delete(partnerId);
      privateChats.delete(socket.id);
    }
    
    // Remove from all rooms
    chatRooms.forEach((room, roomId) => {
      if (room.members.has(socket.id)) {
        room.members.delete(socket.id);
        
        // Notify room members
        if (room.members.size > 0) {
          io.to(roomId).emit('room message', {
            id: Date.now(),
            text: `Anonymous #${userAnonymousId} left the room`,
            sender: 'System',
            timestamp: new Date().toLocaleTimeString(),
            isSystem: true
          });
        }
        
        // Delete room if creator left or empty
        if (socket.id === room.creator || room.members.size === 0) {
          chatRooms.delete(roomId);
          io.to(roomId).emit('room closed');
        }
      }
    });
    
    connectedUsers.delete(socket.id);
    
    // Clear messages for all users when someone leaves
    io.emit('clear messages');
    
    // Notify others that someone left
    io.emit('user left', {
      message: 'A user left the chat',
      userCount: connectedUsers.size
    });
    
    io.emit('user count', connectedUsers.size);
    
    // Send updated user list to remaining clients
    const userList = Array.from(connectedUsers.entries()).map(([socketId, userId]) => ({
      socketId: socketId,
      anonymousId: userId,
      inPrivateChat: privateChats.has(socketId)
    }));
    io.emit('user list', userList);
    
    // Send updated room list
    const roomList = Array.from(chatRooms.entries()).map(([id, room]) => ({
      roomId: id,
      name: room.name,
      creator: room.creatorAnonymousId,
      memberCount: room.members.size
    }));
    io.emit('room list', roomList);
    
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
