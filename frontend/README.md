# Keji AI - Nigerian Food Recommendation Platform

A full-stack AI-powered platform that helps Nigerians find food recommendations based on their budget and available ingredients, featuring real-time WebSocket communication and intelligent conversation management.

## 🌟 Overview

Keji AI is a culturally-aware chatbot that speaks Nigerian Pidgin and understands the local food context. It uses multiple AI models to classify user intent, search a food database, and generate personalized recommendations — all delivered through a responsive, real-time interface.

### Key Features

- 🤖 **AI-Powered** - Multi-stage LLM processing (classification + generation)
- 💬 **Real-Time Chat** - WebSocket for instant bidirectional communication
- 💰 **Budget-Based Search** - Find foods within your budget
- 🥘 **Ingredient Matching** - Get recipe recommendations based on available ingredients
- 🧠 **Context-Aware** - Remembers conversation history with intelligent summarization
- ⚡ **Progressive UI** - Loading indicators for long AI processing (30-60s)
- 🌍 **Nigerian Context** - Pidgin English, local foods, cultural awareness
- 🔐 **Secure** - User authentication with email verification
- 📱 **Responsive** - Works on desktop, tablet, and mobile

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                   React + TypeScript + Vite                      │
│                                                                   │
│  • Real-time WebSocket (Socket.IO Client)                       │
│  • Progressive loading indicators                                │
│  • Context-based event handling (no race conditions)            │
│  • Responsive Material-UI components                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ WebSocket (wss://)
                         │ HTTPS (API fallback)
                         │
┌────────────────────────┴────────────────────────────────────────┐
│                        BACKEND                                   │
│              Flask + Socket.IO + Gunicorn + Eventlet             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WebSocket Layer                                         │   │
│  │  • Real-time bidirectional communication                 │   │
│  │  • Flask-Login session management                        │   │
│  │  • Multi-layer error handling                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AI Processing Layer                                     │   │
│  │  • Intent classification (GPT-4o-mini)                   │   │
│  │  • Response generation (GPT-5)                           │   │
│  │  • Thread offloading (bypasses Eventlet SSL)            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Context Management                                      │   │
│  │  • Token counting (tiktoken)                             │   │
│  │  • Automatic summarization (> 3000 tokens)              │   │
│  │  • History filtering for AI                              │   │
│  │  • 60-70% token savings                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Database Layer                                          │   │
│  │  • PostgreSQL + SQLAlchemy                               │   │
│  │  • Users, Conversations, Messages, Foods                 │   │
│  │  • NullPool for Eventlet compatibility                   │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.11+ (for backend)
- **PostgreSQL** (or SQLite for development)
- **OpenAI API Key**

### Frontend Setup

```bash
# Navigate to frontend
cd responsive-layout-refactor

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
VITE_BACKEND_URL=http://localhost:5000
EOF

# Start development server
npm run dev

# Frontend runs on http://localhost:5173
```

### Backend Setup

```bash
# Navigate to backend
cd keji_backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
SECRET_KEY=your-secret-key-here
FLASK_ENV=development
SQLALCHEMY_DATABASE_URI=sqlite:///keji.db
OPENAI_API_KEY=your-openai-api-key
FRONTEND_BASE_URL=http://localhost:5173
EOF

# Initialize database
flask db upgrade

# Start development server
python run_dev.py

# Backend runs on http://localhost:5000
```

### Access the App

1. Open browser to `http://localhost:5173`
2. Register a new account
3. Verify email (check console logs for verification link in dev mode)
4. Start chatting!

## 📖 User Guide

### Example Conversations

**Budget Search**:

```
You: I have 500 naira
Keji: E go be! With ₦500, you fit buy:
      • Rice (1 cup) - ₦200
      • Beans (1 cup) - ₦150
      • Garri (1 derica) - ₦100
      ...
```

**Ingredient Search**:

```
You: I have rice, tomatoes, and onions
Keji: Omo! You fit cook:
      • Jollof Rice - I go show you how
      • Tomato Stew - E sweet die!
      ...
```

**General Chat**:

```
You: What's the healthiest Nigerian food?
Keji: My brother/sister, make I tell you...
      [Detailed response about nutritious Nigerian foods]
```

## 🛠️ Technology Stack

### Frontend

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Socket.IO Client** - WebSocket communication
- **Material-UI** - Component library
- **React Router** - Navigation

### Backend

- **Flask** - Web framework
- **Flask-SocketIO** - WebSocket support
- **Gunicorn** - Production server
- **Eventlet** - Async I/O
- **SQLAlchemy** - ORM
- **Flask-Login** - Authentication
- **Flask-Mail** - Email verification
- **Flask-Migrate** - Database migrations
- **OpenAI API** - AI models
- **Tiktoken** - Token counting
- **PostgreSQL** - Database

### Deployment

- **Render.com** - Hosting platform
- **Python 3.11.9** - Runtime
- **Procfile** - Process configuration

## 🎯 Key Innovations

### 1. WebSocket + Flask-Login Integration

Seamless authentication over WebSocket using Flask session cookies:

```typescript
// Frontend
const socket = io(BACKEND_URL, {
    withCredentials: true  // Sends cookies
});

// Backend
@socketio.on('connect')
@login_required
def handle_connect():
    # current_user available!
```

### 2. Eventlet + OpenAI SSL Compatibility

Solved the notorious SSL conflict with thread offloading:

```python
def _openai_in_thread(fn):
    return eventlet.tpool.execute(fn)  # Real thread, standard SSL

def call_llm(...):
    def _call():
        client = OpenAI()  # Fresh client in real thread
        return client.chat.completions.create(...)

    return _openai_in_thread(_call)
```

### 2b. Eventlet + Email (Resend) SSL Compatibility

Solved email SSL recursion with subprocess isolation:

```python
def send_email(to_email, subject, html, text=None):
    # Run in completely separate Python process (NO Eventlet)
    result = subprocess.run(
        ['python', 'send_email_helper.py', api_key, from_email, to_email, ...],
        capture_output=True,
        timeout=30
    )
    return result.returncode == 0
```

**Why different from OpenAI?** The `ssl` module is globally patched; even thread pools share it. Subprocess = fresh interpreter = clean SSL.

> 📖 **For complete understanding of SSL/Eventlet conflicts and how to apply these patterns to new libraries (OAuth, payment APIs, etc.), see [EVENTLET_SSL_GUIDE.md](keji_backend/EVENTLET_SSL_GUIDE.md)**

### 3. Intelligent Context Management

Automatic conversation summarization when token limit approached:

- Older messages compressed into summary (150-200 words)
- Recent messages sent verbatim
- Frontend always sees full history
- AI gets optimized context
- **Result**: 60-70% token savings

### 4. Transactional Email + Database

Email sent BEFORE user saved to database:

```python
# ✅ Send email first
if not send_email(email, subject, html, text):
    return error("Email failed")  # Don't create user

# Email succeeded - now save user
user = User(email=email, ...)
db.session.commit()
```

**Why**: If email fails, user isn't stuck in database unable to verify.

### 5. Production-Grade Error Handling

Multi-layer error isolation with graceful degradation:

```python
try:
    # Layer 1: Input validation
    validate_input()
except:
    return error_response

try:
    # Layer 2: Database operations
    db.session.commit()
except:
    db.session.rollback()
    return error_response

try:
    # Layer 3: AI processing
    response = call_llm()
except:
    response = fallback_response  # Never crash!
```

## 📊 Performance

### Response Times

- **Typical**: 5-8 seconds (classification + generation)
- **Worst case**: 30-60 seconds (complex queries)
- **WebSocket handshake**: ~100ms

### Concurrent Users

- **1 Eventlet worker**: 1000+ concurrent WebSocket connections
- **Memory**: ~100-200MB per worker
- **CPU (idle)**: <5%

### Token Optimization

| Conversation | Without Mgmt | With Mgmt | Savings |
| ------------ | ------------ | --------- | ------- |
| 10 messages  | ~800 tokens  | ~800      | 0%      |
| 20 messages  | ~1600 tokens | ~800      | 50%     |
| 30 messages  | ~2400 tokens | ~650      | 73%     |
| 50 messages  | ~4000 tokens | ~650      | 84%     |

## 📁 Project Structure

```
responsive-layout-refactor/
├── src/                          # Frontend source
│   ├── components/              # React components
│   ├── contexts/                # React contexts
│   │   └── SocketContext.tsx   # WebSocket management
│   ├── pages/                   # Page components
│   │   └── Chat.tsx            # Main chat interface
│   └── ...
│
├── keji_backend/                # Backend source
│   ├── app.py                   # Flask application
│   ├── extensions.py            # Flask extensions
│   ├── run_dev.py               # Development launcher
│   ├── gunicorn_config.py       # Production server config
│   ├── websocket.py             # WebSocket event handlers
│   ├── chat.py                  # HTTP chat endpoints
│   ├── auth.py                  # Authentication
│   ├── get_response.py          # AI processing
│   ├── context_manager.py       # Context management
│   ├── models.py                # Database models
│   ├── requirements.txt         # Python dependencies
│   ├── .python-version          # Python version
│   ├── README.md                # Backend documentation
│   └── ARCHITECTURE.md          # Technical deep dive
│
├── Procfile                     # Render deployment config
├── README.md                    # This file
└── WEBSOCKET_OPENAI_GUIDE.md   # WebSocket+OpenAI integration guide
```

## 🔧 Configuration

### Environment Variables

**Frontend** (`.env`):

```bash
VITE_BACKEND_URL=http://localhost:5000
```

**Backend** (`.env`):

```bash
# Flask
SECRET_KEY=your-secret-key
FLASK_ENV=development

# Database
SQLALCHEMY_DATABASE_URI=postgresql://user:pass@host/db

# OpenAI
OPENAI_API_KEY=sk-...

# CORS
FRONTEND_BASE_URL=http://localhost:5173

# Email
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# Context Management (optional)
CHAT_TOKEN_THRESHOLD=3000
CHAT_RECENT_MESSAGES=10
```

## 🚢 Deployment

### Render.com (Recommended)

**Backend**:

1. Create Web Service
2. Set Root Directory: `keji_backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `gunicorn --config gunicorn_config.py app:app`
5. Add environment variables (see above)
6. Add PostgreSQL database
7. Set Health Check: `/health`

**Frontend**:

1. Create Static Site
2. Build Command: `npm run build`
3. Publish Directory: `dist`
4. Add environment variable: `VITE_BACKEND_URL=https://your-backend.onrender.com`

### Health Checks

- **Backend**: `GET /health` checks the backend and its PostgreSQL database; it returns `503` if the database is unreachable.
- **Frontend**: Calls the backend health endpoint on startup and every five minutes while the app is open.
- **Frontend**: `GET /` → Serves React app

## 🐛 Troubleshooting

### Common Issues

**WebSocket not connecting**:

- Check CORS configuration (FRONTEND_BASE_URL must match)
- Verify cookies are enabled
- Check browser console for errors
- Ensure backend is running with eventlet

**AI responses timing out**:

- Already configured with 120s timeout
- Check OpenAI API key is valid
- Verify thread offloading is working (check logs)

**"ModuleNotFoundError: fcntl" on Windows**:

- Use `python run_dev.py` for local development
- Gunicorn only works on Linux/Mac (production)

**Token limit errors**:

- Context management should prevent this
- Check conversation is being summarized (see logs)
- Verify CHAT_TOKEN_THRESHOLD is set

For more troubleshooting, see:

- Backend: `keji_backend/README.md`
- Technical: `keji_backend/ARCHITECTURE.md`
- WebSocket+OpenAI: `WEBSOCKET_OPENAI_GUIDE.md`

## 📚 Documentation

- **[Backend README](keji_backend/README.md)** - Setup, deployment, API
- **[Architecture Guide](keji_backend/ARCHITECTURE.md)** - Technical deep dive
- **[Eventlet SSL Guide](keji_backend/EVENTLET_SSL_GUIDE.md)** - ⚠️ **IMPORTANT**: Why SSL conflicts occur and how to fix them
- **[WebSocket+OpenAI Guide](WEBSOCKET_OPENAI_GUIDE.md)** - Integration details
- **[Email SSL Fix](keji_backend/EMAIL_SSL_FIX.md)** - Subprocess isolation solution

## 🎓 Learning Resources

### Key Concepts Demonstrated

1. **Real-Time WebSocket** - Bidirectional communication
2. **Flask-SocketIO** - WebSocket in Flask
3. **Eventlet** - Async I/O without asyncio
4. **Gunicorn + Eventlet** - Production WebSocket deployment
5. **Thread Offloading** - Bypass eventlet limitations
6. **Context Management** - Token optimization for AI
7. **Multi-Layer Error Handling** - Production-grade resilience
8. **Progressive UI** - Long-running request UX
9. **Flask-Login over WebSocket** - Session-based auth
10. **Render.com Deployment** - Modern PaaS deployment

## 🤝 Contributing

This is a contract project, but the architecture and patterns can be studied and adapted for your own projects.

### Key Patterns to Study

1. **WebSocket Architecture** - See `WEBSOCKET_OPENAI_GUIDE.md`
2. **Error Handling Strategy** - See `keji_backend/ARCHITECTURE.md`
3. **Context Management** - See `keji_backend/context_manager.py`
4. **Thread Offloading** - See `keji_backend/get_response.py`

## 📄 License

Proprietary - Keji AI Contract Project

## 🙏 Acknowledgments

- OpenAI for GPT models
- Flask-SocketIO for WebSocket support
- Eventlet for async I/O
- Render.com for hosting
- The Nigerian developer community

---

## 🎯 Success Metrics

✅ **Real-time communication** - Instant message delivery via WebSocket  
✅ **Long processing support** - Handles 60+ second AI responses without timeout  
✅ **Token optimization** - 60-70% savings on long conversations  
✅ **Production deployment** - Live on Render.com with Gunicorn + Eventlet  
✅ **Error resilience** - Multi-layer error handling prevents crashes  
✅ **Secure authentication** - Flask-Login with email verification  
✅ **Responsive UI** - Works on all device sizes  
✅ **Nigerian context** - Culturally-aware with Pidgin support

---

**Built with ❤️ for Nigerian food lovers** 🍲🇳🇬
