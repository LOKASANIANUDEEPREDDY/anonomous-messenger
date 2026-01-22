const socket = io();

const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const userIdSpan = document.getElementById('your-id');
const userCountSpan = document.getElementById('user-count');
const typingIndicator = document.getElementById('typing-indicator');

let myAnonymousId = null;
let typingTimeout;

// Handle welcome message and get anonymous ID
socket.on('welcome', (data) => {
    myAnonymousId = data.anonymousId;
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

// Handle incoming messages
socket.on('chat message', (messageData) => {
    addMessage(messageData);
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
        socket.emit('chat message', message);
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
