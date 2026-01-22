const socket = io();

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userIdSpan = document.getElementById('your-id');
const userCountSpan = document.getElementById('user-count');
const typingIndicator = document.getElementById('typing-indicator');
const toggleUsersBtn = document.getElementById('toggle-users');
const closeSidebarBtn = document.getElementById('close-sidebar');
const userSidebar = document.getElementById('user-sidebar');
const userListDiv = document.getElementById('user-list');
const chatModeDiv = document.getElementById('chat-mode');

let myAnonymousId = null;
let mySocketId = null;
let typingTimeout;
let currentPrivateChat = null; // { socketId, anonymousId }
let allUsers = [];

// Handle welcome message and get anonymous ID
socket.on('welcome', (data) => {
    myAnonymousId = data.anonymousId;
    mySocketId = socket.id;
    userIdSpan.textContent = `Your ID: Anonymous #${myAnonymousId}`;
    
    // Add system message
    addSystemMessage(data.message);
});

// Handle user count updates
socket.on('user count', (count) => {
    userCountSpan.textContent = `👥 ${count} user${count !== 1 ? 's' : ''} online`;
});

// Handle user joined
socket.on('user joined', (data) => {
    addSystemMessage(data.message);
});

// Handle user left
socket.on('user left', (data) => {
    addSystemMessage(data.message);
});

// Handle clear messages
socket.on('clear messages', () => {
    messagesDiv.innerHTML = '';
    addSystemMessage('Messages cleared');
});

// Handle user list updates
socket.on('user list', (users) => {
    allUsers = users;
    updateUserList();
});

// Handle private chat request
socket.on('private chat request', (data) => {
    const accept = confirm(`Anonymous #${data.fromAnonymousId} wants to chat privately. Accept?`);
    if (accept) {
        socket.emit('private chat accept', data);
    }
});

// Handle private chat started
socket.on('private chat started', (data) => {
    currentPrivateChat = data;
    messagesDiv.innerHTML = '';
    chatModeDiv.textContent = `Private Chat with Anonymous #${data.withAnonymousId}`;
    chatModeDiv.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
    addSystemMessage(`Started private chat with Anonymous #${data.withAnonymousId}`);
    addSystemMessage('Click "Leave Private Chat" to return to public chat');
    
    // Add leave button
    const leaveBtn = document.createElement('button');
    leaveBtn.textContent = '← Leave Private Chat';
    leaveBtn.className = 'leave-private-btn';
    leaveBtn.onclick = leavePrivateChat;
    chatModeDiv.appendChild(leaveBtn);
});

// Handle private messages
socket.on('private message', (messageData) => {
    // Only show private messages if we're IN a private chat
    if (currentPrivateChat) {
        addMessage(messageData);
    }
});

// Handle partner left private chat
socket.on('partner left private chat', () => {
    if (currentPrivateChat) {
        addSystemMessage('Your chat partner left the private chat');
        leavePrivateChat();
    }
});

// Handle left private chat
socket.on('left private chat', () => {
    currentPrivateChat = null;
    chatModeDiv.textContent = 'Public Chat';
    chatModeDiv.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    messagesDiv.innerHTML = '';
    addSystemMessage('Returned to public chat');
});

// Handle incoming messages
socket.on('chat message', (messageData) => {
    // Only show public messages if we're NOT in a private chat
    if (!currentPrivateChat) {
        addMessage(messageData);
    }
});

// Handle typing indicator
socket.on('typing', (data) => {
    if (data.isTyping) {
        typingIndicator.textContent = `${data.sender} is typing...`;
    } else {
        typingIndicator.textContent = '';
    }
});

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (message) {
        if (currentPrivateChat) {
            // Send private message
            socket.emit('private message', {
                to: currentPrivateChat.with,
                message: message
            });
        } else {
            // Send public message
            socket.emit('chat message', message);
        }
        messageInput.value = '';
        
        // Stop typing indicator
        socket.emit('typing', false);
    }
}

// Add message to chat
function addMessage(messageData) {
    const messageDiv = document.createElement('div');
    const isOwnMessage = messageData.sender === `Anonymous #${myAnonymousId}`;
    
    messageDiv.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    messageDiv.innerHTML = `
        <div class="message-sender">${messageData.sender}</div>
        <div class="message-text">${escapeHtml(messageData.text)}</div>
        <div class="message-time">${messageData.timestamp}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

// Add system message
function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = text;
    
    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

// Scroll to bottom of messages
function scrollToBottom() {
    messagesDiv.parentElement.scrollTop = messagesDiv.parentElement.scrollHeight;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Typing indicator
messageInput.addEventListener('input', () => {
    socket.emit('typing', true);
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', false);
    }, 1000);
});

// Stop typing when focus is lost
messageInput.addEventListener('blur', () => {
    socket.emit('typing', false);
});

// Handle connection errors
socket.on('connect_error', (error) => {
    addSystemMessage('Connection error. Please refresh the page.');
});

socket.on('disconnect', () => {
    addSystemMessage('Disconnected from server. Trying to reconnect...');
});

socket.on('reconnect', () => {
    addSystemMessage('Reconnected to server!');
});

// Toggle user sidebar
toggleUsersBtn.addEventListener('click', () => {
    userSidebar.classList.add('active');
});

closeSidebarBtn.addEventListener('click', () => {
    userSidebar.classList.remove('active');
});

// Update user list display
function updateUserList() {
    userListDiv.innerHTML = '';
    
    allUsers.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        if (user.socketId === socket.id) {
            userItem.classList.add('you');
            userItem.innerHTML = `
                <span class="user-name">Anonymous #${user.anonymousId}</span>
                <span class="user-badge">YOU</span>
            `;
        } else {
            if (user.inPrivateChat) {
                // User is in private chat - show status
                userItem.classList.add('in-private');
                userItem.innerHTML = `
                    <span class="user-name">Anonymous #${user.anonymousId}</span>
                    <span class="private-badge">🔒 In Private Chat</span>
                `;
            } else {
                // User is available
                userItem.innerHTML = `
                    <span class="user-name">Anonymous #${user.anonymousId}</span>
                    <button class="chat-btn" onclick="requestPrivateChat('${user.socketId}', ${user.anonymousId})">
                        💬 Chat
                    </button>
                `;
            }
        }
        
        userListDiv.appendChild(userItem);
    });
}

// Request private chat
function requestPrivateChat(socketId, anonymousId) {
    if (currentPrivateChat) {
        alert('You are already in a private chat. Leave it first.');
        return;
    }
    
    // Check if target user is already in a private chat
    const targetUser = allUsers.find(u => u.socketId === socketId);
    if (targetUser && targetUser.inPrivateChat) {
        alert(`Anonymous #${anonymousId} is already in a private chat.`);
        return;
    }
    
    socket.emit('private chat request', socketId);
    addSystemMessage(`Sent private chat request to Anonymous #${anonymousId}`);
    userSidebar.classList.remove('active');
}

// Leave private chat
function leavePrivateChat() {
    if (currentPrivateChat) {
        socket.emit('leave private chat', currentPrivateChat.with);
    }
}

// Make requestPrivateChat global
window.requestPrivateChat = requestPrivateChat;
