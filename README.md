# SlateX 🖊️

**A real-time collaborative whiteboard platform with AI-powered features for smart drawing, text recognition, voice notes, and automated summaries.**

🔗 **Live Demo:** [slatex-sbca.onrender.com](https://slatex-sbca.onrender.com/)

---

## 📖 About

SlateX is a full-stack, real-time collaborative whiteboard application that allows multiple users to draw, sketch, and brainstorm together on a shared canvas — instantly synced across all connected clients. Beyond standard whiteboard functionality, SlateX integrates AI capabilities (powered by Google's Gemini API) to summarize board content and convert speech to text, making it a powerful tool for remote teams, classrooms, and brainstorming sessions.

---

## ✨ Features

- **🔄 Real-Time Collaboration** — Multiple users can join the same room and draw together with instant updates across all connected clients.
- **🖌️ Live Drawing Sync** — Drawing strokes are streamed in real time using WebSockets (Socket.IO), so every participant sees changes as they happen.
- **🔒 Draw Lock (One-User-at-a-Time Mode)** — Optional mode that allows only one user to draw at a time, preventing overlapping strokes during structured sessions.
- **🔁 Late Joiner Sync (State Recovery)** — Users who join a session midway automatically receive the full current board state.
- **👤 Username Support** — Each participant can set a display name visible to others in the room.
- **🟢 Active Drawer Indicator** — Shows which user currently has drawing control.
- **🏠 Homepage + Canvas Integration** — A unified homepage merged seamlessly with the whiteboard canvas.
- **🗂️ Domain-Based Templates** — Multiple whiteboard templates available based on use-case/domain.
- **🚪 Rooms System** — Create and join independent whiteboard rooms for separate sessions.
- **🕓 Recent Rooms** — Quickly access your last 5 visited rooms.
- **🌙 Dark Mode** — Toggle between light and dark themes for comfortable viewing.
- **💬 Chatbox** — In-room chat for real-time communication alongside drawing.
- **🛠️ Room Admin Controls** — Optimized authorization system for room administrators.
- **⚡ Performance Optimizations** — Fixed lag and latency issues during live drawing.
- **🧠 AI Board Summarization** — Automatically generate concise summaries of whiteboard content using the Gemini API.
- **🎙️ Speech-to-Text** — Convert voice notes into text directly on the board.

---

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Real-Time Communication:** Socket.IO (WebSockets)
- **Database:** MongoDB with Mongoose
- **AI Integration:** Google Gemini API (for summarization & speech-to-text features)
- **Deployment:** Render

---

## 📂 Project Structure

SlateX/

├── middleware/        # Express middleware (auth, validation, etc.)

├── models/            # Mongoose schemas/models

├── public/            # Static frontend assets (HTML, CSS, JS)

├── routes/            # API route handlers

├── .env.example       # Sample environment variables

├── config.json        # App configuration

├── render.yaml        # Render deployment configuration

├── server.js          # Application entry point

├── package.json       # Project dependencies and scripts

└── README.md
---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- npm
- A MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A Google Gemini API key (for AI features)

### Installation

1. **Clone the repository**
```bash
   git clone https://github.com/Jeee3T/SlateX.git
   cd SlateX
```

2. **Install dependencies**
```bash
   npm install
```

3. **Set up environment variables**

   Copy `.env.example` to `.env` and fill in the required values:
```bash
   cp .env.example .env
```

   Typical variables include:
```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   GEMINI_API_KEY=your_gemini_api_key
```

4. **Run the application**
```bash
   node server.js
```

5. **Open in browser**

   Visit `http://localhost:5000` (or your configured port) to start using SlateX.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is open source. Feel free to use and modify it for your own purposes.

---

## 👤 Author

**Prasanjeet Panda (Jeee3T)**
- GitHub: [@Jeee3T](https://github.com/Jeee3T)

---

⭐ If you find this project useful, consider giving it a star on GitHub!
