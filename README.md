# 🔒 Anonymous Messenger App

A real-time anonymous messenger application where all participants are shown as "Anonymous" with randomly assigned user IDs. Built with Node.js, Express, and Socket.io.

## Features

- ✅ **Complete Anonymity**: All users are shown as "Anonymous #XXXX" with random IDs
- ✅ **Real-time Messaging**: Instant message delivery using WebSockets
- ✅ **Typing Indicators**: See when other users are typing
- ✅ **User Count**: Display number of online users
- ✅ **Modern UI**: Clean, responsive design with gradient colors
- ✅ **System Notifications**: Join/leave notifications
- ✅ **Auto-reconnection**: Handles disconnections gracefully

## Tech Stack

- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript

## Installation

1. **Install dependencies**:
```bash
npm install
```

## Running the Application

### Development Mode (with auto-restart):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. You'll be automatically assigned an anonymous ID (e.g., "Anonymous #1234")
3. Start chatting! All messages are anonymous
4. Open multiple browser windows to test multi-user chat

## Project Structure

```
anonymous-messenger/
├── server.js              # Express server with Socket.io
├── package.json           # Dependencies and scripts
├── README.md             # This file
└── public/               # Frontend files
    ├── index.html        # Chat interface
    ├── styles.css        # Styling
    └── client.js         # Client-side Socket.io logic
```

## How It Works

1. **Server** (`server.js`):
   - Creates Express server with Socket.io
   - Assigns random anonymous IDs to each connection
   - Handles message broadcasting
   - Manages typing indicators
   - Tracks connected users

2. **Client** (`public/client.js`):
   - Connects to Socket.io server
   - Sends/receives messages
   - Displays typing indicators
   - Updates user count
   - Handles system notifications

3. **UI** (`public/index.html` & `styles.css`):
   - Modern gradient design
   - Responsive layout
   - Message bubbles (own messages on right, others on left)
   - Smooth animations

## Customization

### Change Port
Edit `server.js`:
```javascript
const PORT = process.env.PORT || 3000; // Change 3000 to your port
```

### Modify Anonymous ID Format
Edit `server.js` - `generateAnonymousId()` function:
```javascript
function generateAnonymousId() {
    // Current: generates 4-digit numbers (1000-9999)
    return Math.floor(Math.random() * 9000) + 1000;
}
```

### Change Color Scheme
Edit `public/styles.css` - Look for gradient colors:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

## Security Notes

- Messages are **not encrypted** in this basic version
- Messages are **not stored** - they only exist in memory
- No authentication is implemented
- For production use, consider adding:
  - HTTPS/TLS encryption
  - Message persistence (database)
  - Rate limiting
  - Input validation and sanitization
  - Content moderation

## Browser Compatibility

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT License - Feel free to use and modify!

## Future Enhancements

- [ ] Message persistence (save chat history)
- [ ] Private rooms
- [ ] File/image sharing
- [ ] Emoji picker
- [ ] Message reactions
- [ ] Dark mode
- [ ] User avatars (anonymous themed)
- [ ] Message encryption

---

**Enjoy your anonymous conversations! 🔒**
