// ============================================
// UPDATE YOUR server.js FILE
// ============================================

require('dotenv').config();
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms"); // ADD THIS LINE
const { isAuthenticated, redirectIfAuthenticated } = require("./middleware/authMiddleware");

// Google AI configuration
const { GoogleGenerativeAI } = require("@google/generative-ai");
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error("❌ GOOGLE_API_KEY is missing from environment!");
} else {
  console.log(`✅ GOOGLE_API_KEY loaded: ${GOOGLE_API_KEY.substring(0, 4)}...${GOOGLE_API_KEY.substring(GOOGLE_API_KEY.length - 4)}`);
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =======================
// 🗄️ DATABASE CONNECTION
// =======================

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// =======================
// 🧠 WHITEBOARD STATE (Now Room-based)
// =======================

// Store active room sessions in memory
const activeRooms = new Map();

// =======================
// ⚙️ MIDDLEWARE
// =======================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// =======================
// 🌐 ROUTES
// =======================

// Landing page (public)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Auth page (redirect if already logged in)
app.get("/auth", redirectIfAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "auth.html"));
});

// Room selection (protected - requires login)
app.get("/room", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

// Domain selection (protected - requires login)
app.get("/domain", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "domain.html"));
});

// Canvas page (protected - requires login)
app.get("/canvas", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "canvas.html"));
});

// Auth API routes
app.use("/api/auth", authRoutes);

// Room API routes - ADD THIS LINE
app.use("/api/rooms", roomRoutes);

// AI Board Summarization endpoint
app.post("/api/summarize", isAuthenticated, async (req, res) => {
  try {
    const { boardData, boardImage } = req.body;

    if (!boardData) {
      return res.status(400).json({ error: "Board data is required" });
    }

    const { textElements, stickyNotes, shapes, templateName } = boardData;

    // Construct a rich prompt based on board content
    let contentDescription = "";

    if (templateName) {
      contentDescription += `The board uses the template: "${templateName}".\n`;
    }

    if (textElements && textElements.length > 0) {
      contentDescription += "Text elements found on board:\n";
      textElements.forEach(t => contentDescription += `- ${t.text}\n`);
    }

    if (stickyNotes && stickyNotes.length > 0) {
      contentDescription += "Sticky notes found on board:\n";
      stickyNotes.forEach(n => contentDescription += `- ${n.content}\n`);
    }

    if (shapes && shapes.length > 0) {
      contentDescription += "Shapes explicitly drawn on board:\n";
      shapes.forEach(s => {
        const colorScale = s.color || "blue";
        contentDescription += `- A ${colorScale} ${s.type} (coordinates: ${Math.round(s.x)}, ${Math.round(s.y)})\n`;
      });
    }

    console.log(`[AI] Summarizing board content (with image) for user ${req.session.userId}`);

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    let promptParts = [
      `You are a practical human teammate summarizing a SlateX whiteboard. 
        Your goal is to provide a SIMPLE, GROUNDED, and USEFUL summary of what is actually on the board.
        
        CRITICAL INSTRUCTIONS:
        - **Keep it Simple**: If the board is simple, keep the summary simple. Do not over-analyze or use "corporate speak" (e.g., avoid "meta-commentary", "concept modeling", "semantic drift").
        - **Be Literal & Real**: Use the structured list of shapes and text below as your source of truth. If the list says there is a "circle", it is a circle, even if it looks slightly different in the low-res image.
        - **Identify Key Info**: Just tell me what the topic is and what the main notes/drawings are.
        - **Tone**: Friendly, professional, and DIRECT. No fluff.
        
        Input Data (Structured Reality):
        ${contentDescription || "No specific objects identified."}
        
        Input Data (Visual Verification):
        Analyze the image to confirm context and spatial arrangement.
        
        Output Structure (MUST FOLLOW EXACTLY):
        [EXECUTIVE SUMMARY]
        (A concise 2-sentence overview)
        
        [KEY INSIGHTS]
        - (Insight 1)
        - (Insight 2)
        - (Insight 3)
        
        [METADATA]
        Complexity: (1-5)
        Density: (1-5)
        Signal: (1-5)
        
        [SECONDARY INSIGHTS]
        (Brief deeper analysis)
        
        **IMPORTANT**: No markdown symbols (#, *, etc.). Use the exact brackets [ ] for section headers. 
        
        Write the insights now:`
    ];

    // If we have an image, add it to the prompt parts
    if (boardImage && boardImage.includes('base64,')) {
      const base64Data = boardImage.split('base64,')[1];
      promptParts.push({
        inlineData: {
          data: base64Data,
          mimeType: "image/png"
        }
      });
    }

    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const summary = response.text();

    console.log(`[AI] Multimodal summary generated successfully`);
    res.json({ summary });

  } catch (error) {
    if (error.status === 429 || error.message?.includes('429')) {
      console.warn("[AI] Rate limit hit");
      return res.status(429).json({ error: "Rate limit reached. Please wait 30-60 seconds and try again." });
    }
    console.error("[AI] Error summarizing board:", error);
    res.status(500).json({ error: error.message || "Failed to generate summary" });
  }
});

// AI Insight Chat Endpoint
app.post('/api/ai-chat', isAuthenticated, async (req, res) => {
  try {
    const { question, summary, boardData } = req.body;
    console.log(`[AI Chat DEBUG] Request received. Summary length: ${summary?.length || 0}`);
    console.log(`[AI Chat DEBUG] Board Objects: Paths=${boardData?.paths?.length}, Shapes=${boardData?.shapes?.length}, Notes=${boardData?.stickyNotes?.length}`);

    if (!question) return res.status(400).json({ error: 'Question is required' });
    if (!boardData) return res.status(400).json({ error: 'boardData is missing' });

    // Using gemini-flash-latest which is confirmed working for summary
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
        You are an AI Board Assistant. You are chatting with a user about a specific whiteboard they just summarized.
        
        CONTEXT:
        [Generated Summary]:
        ${summary}
        
        [Board Details]:
        Text: ${JSON.stringify(boardData.textElements)}
        Notes: ${JSON.stringify(boardData.stickyNotes)}
        Shapes: ${JSON.stringify(boardData.shapes)}
        
        USER QUESTION: "${question}"
        
        INSTRUCTIONS:
        - Answer the user's question concisely based on the context provided.
        - If the answer isn't in the context, use your intelligence to provide a helpful response related to visual thinking or the board's likely goal.
        - Keep the tone professional, helpful, and "Gen Z/Modern SaaS" (clean, direct, premium).
        - Avoid markdown headers. Use bold text for emphasis sparingly.
        
        Response:`;

    console.log(`[AI Chat] Prompt generated. Sending to Gemini...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log(`[AI Chat] Gemini responded with text length: ${text.length}`);
    res.json({ answer: text });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    if (error.status === 429 || error.message?.includes('429')) {
      console.warn("[AI Chat] Rate limit hit");
      return res.status(429).json({ error: "Rate limit reached. Please wait 30-60 seconds." });
    }
    res.status(500).json({ error: error.message || 'Failed to generate response' });
  }
});


// =======================
// 📌 SOCKET.IO LOGIC (Room-based)
// =======================

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  let currentRoom = null;
  let currentDrawer = null;

  // Join a room
  socket.on("join-room", async (rawRoomId, username, userId) => {
    try {
      const roomId = rawRoomId.toUpperCase();
      currentRoom = roomId;
      socket.join(roomId);

      // Initialize room if it doesn't exist in memory
      if (!activeRooms.has(roomId)) {
        // Load room state from MongoDB
        const Room = require('./models/Room');
        const room = await Room.findOne({ roomId }).populate('creator');

        if (room) {
          activeRooms.set(roomId, {
            currentDrawer: null,
            users: {}, // { socketId: { username, isAdmin, hasAccess } }
            boardState: room.boardState,
            creatorId: room.creator._id.toString(),
            creatorUsername: room.creator.username
          });
        } else {
          activeRooms.set(roomId, {
            currentDrawer: null,
            users: {},
            boardState: {
              paths: [],
              shapes: [],
              textElements: [],
              stickyNotes: [],
              templateTexts: [],
              medicalStamps: [],
              financeStamps: [],
              financeCards: [],
              financeFields: {}, // 🆕 Added field tracking
              projectTasks: [],
              templateTransform: { x: 96.7, y: 87.9, scale: 1 },
              templateKey: null,
              templateInstances: [] // Support for multiple boards
            },
            creatorId: null,
            creatorUsername: null
          });
        }
      } else {
        // Enrichment: If room exists in memory but lacks metadata (due to previous code version), re-fetch it
        const roomData = activeRooms.get(roomId);
        if (roomData && (!roomData.creatorUsername || !roomData.creatorId)) {
          const Room = require('./models/Room');
          const room = await Room.findOne({ roomId }).populate('creator');
          if (room) {
            roomData.creatorId = room.creator._id.toString();
            roomData.creatorUsername = room.creator.username;
          }
        }
      }

      const roomData = activeRooms.get(roomId);

      // --- 🛡️ DEFINITIVE ADMIN & IDENTITY LOGIC ---

      const normalizedUsername = username.trim().toLowerCase();
      const creatorUsernameInput = (roomData.creatorUsername || "").trim().toLowerCase();
      const dbCreatorId = roomData.creatorId ? String(roomData.creatorId) : null;
      const clientUserId = userId ? String(userId) : null;

      // 1. Find if this user was already in the room (Session Handover)
      let inheritedAdmin = false;
      let inheritedAccess = false;

      const userSocketIds = Object.keys(roomData.users);
      for (const oldSocketId of userSocketIds) {
        const u = roomData.users[oldSocketId];
        const isSameByUserId = (clientUserId && u.userId && String(u.userId) === clientUserId);
        const isSameByUsername = (u.username.trim().toLowerCase() === normalizedUsername);

        if (isSameByUserId || isSameByUsername) {
          inheritedAdmin = u.isAdmin;
          inheritedAccess = u.hasAccess;
          delete roomData.users[oldSocketId]; // Wipe old session to prevent ID conflicts
          console.log(`[SlateX] Handover: ${username} (Socket ${oldSocketId} -> ${socket.id})`);
        }
      }

      // 2. Definitive Creator Check (Source of Truth)
      // We use String() to ensure ObjectIds and Strings compare correctly
      const isCreator = (clientUserId && dbCreatorId && clientUserId === dbCreatorId) ||
        (normalizedUsername === creatorUsernameInput && creatorUsernameInput !== "");

      // 3. Admin Designation
      // FORCE Admin if they are the creator OR if they inherited it OR if they are the first joiner
      const isAdmin = isCreator || inheritedAdmin || (Object.keys(roomData.users).length === 0);

      // 4. Access Designation
      // Admins ALWAYS have access. Others inherit it.
      const hasAccess = isAdmin || inheritedAccess;

      // --- DIAGNOSTICS ---
      console.log(`[SlateX] ${username} re-joined ${roomId}: isAdmin=${isAdmin}, isCreator=${isCreator}, inherited=${inheritedAdmin}`);

      // 5. Register New Session
      roomData.users[socket.id] = {
        userId: clientUserId,
        username,
        isAdmin,
        hasAccess
      };

      // Sync state
      socket.emit("init-board", roomData.boardState);
      socket.emit("user-permissions", { isAdmin, hasAccess });

      // Notify others
      if (inheritedAdmin || inheritedAccess) {
        io.to(roomId).emit("user-list-updated", Object.values(roomData.users));
      } else {
        io.to(roomId).emit("user-joined", {
          username,
          users: Object.values(roomData.users)
        });
      }
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("room-error", "Failed to join room");
    }
  });

  // Chat
  socket.on("chat-message", (msg) => {
    if (currentRoom) {
      io.to(currentRoom).emit("chat-message", msg);
    }
  });

  socket.on("client-typing", (data) => {
    if (currentRoom) {
      console.log(`[CHAT] Typing event in ${currentRoom}: ${data.user} (${data.isTyping})`);
      socket.to(currentRoom).emit("client-typing", data);
    }
  });

  // Handle room name updates
  socket.on('update-room-name', (data) => {
    if (data.roomId && data.name) {
      io.to(data.roomId.toUpperCase()).emit('room-name-updated', { name: data.name });
    }
  });

  // Activity indicator
  socket.on("user-activity", (activity) => {
    if (currentRoom) {
      socket.to(currentRoom).emit("user-activity", {
        username: activeRooms.get(currentRoom)?.users[socket.id]?.username || "Someone",
        activity: activity
      });
    }
  });

  // Drawing permissions
  socket.on("request-draw", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      const userData = roomData?.users[socket.id];

      if (roomData && userData && userData.hasAccess && roomData.currentDrawer === null) {
        roomData.currentDrawer = socket.id;
        socket.emit("draw-allowed", true);
        io.to(currentRoom).emit("active-drawer", userData.username || "Someone");
      } else {
        socket.emit("draw-allowed", false);
      }
    }
  });

  socket.on("draw-point", (data) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        socket.to(currentRoom).emit("draw-point", data);
      }
    }
  });

  socket.on("draw-stroke", (stroke) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.paths.push(stroke);
        socket.to(currentRoom).emit("draw-stroke", stroke);
      }
    }
  });

  socket.on("stroke-delete", (strokeId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.paths = roomData.boardState.paths.filter(p => p.id !== strokeId);
        socket.to(currentRoom).emit("stroke-deleted", strokeId);
      }
    }
  });

  socket.on("release-draw", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.currentDrawer === socket.id) {
        roomData.currentDrawer = null;
        io.to(currentRoom).emit("draw-released");
        io.to(currentRoom).emit("drawer-cleared");
      }
    }
  });

  // Shapes events
  socket.on("shape-add", (shape) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.shapes.push(shape);
        socket.to(currentRoom).emit("shape-added", shape);
      }
    }
  });

  socket.on("shape-update", (updatedShape) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.shapes.findIndex(s => s.id === updatedShape.id);
        if (idx !== -1) {
          roomData.boardState.shapes[idx] = updatedShape;
        }
        socket.to(currentRoom).emit("shape-updated", updatedShape);
      }
    }
  });

  socket.on("shape-delete", (shapeId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.shapes = roomData.boardState.shapes.filter(s => s.id !== shapeId);
        socket.to(currentRoom).emit("shape-deleted", shapeId);
      }
    }
  });

  socket.on("clear-all", () => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) { // Only Admin can clear
        roomData.boardState = {
          paths: [],
          shapes: [],
          textElements: [],
          stickyNotes: [],
          templateTexts: [],
          medicalStamps: [],
          financeStamps: [],
          financeCards: [],
          financeFields: {},
          projectTasks: [],
          templateTransform: { x: 0, y: 0, scale: 1 },
          templateKey: roomData.boardState.templateKey // Keep template on clear
        };
        io.to(currentRoom).emit("clear-all");
      }
    }
  });

  // Text events
  socket.on("text-add", (textElement) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.textElements.push(textElement);
        socket.to(currentRoom).emit("text-added", textElement);
      }
    }
  });

  socket.on("text-update", (updatedText) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.textElements.findIndex(t => t.id === updatedText.id);
        if (idx !== -1) {
          roomData.boardState.textElements[idx] = updatedText;
        }
        socket.to(currentRoom).emit("text-updated", updatedText);
      }
    }
  });

  socket.on("text-delete", (textId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.textElements = roomData.boardState.textElements.filter(t => t.id !== textId);
        socket.to(currentRoom).emit("text-deleted", textId);
      }
    }
  });

  // Sticky notes events
  socket.on("note-add", (note) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.stickyNotes.push(note);
        socket.to(currentRoom).emit("note-added", note);
      }
    }
  });

  socket.on("note-update", (updatedNote) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.stickyNotes.findIndex(n => n.id === updatedNote.id);
        if (idx !== -1) {
          roomData.boardState.stickyNotes[idx] = updatedNote;
        }
        socket.to(currentRoom).emit("note-updated", updatedNote);
      }
    }
  });

  socket.on("note-delete", (noteId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        roomData.boardState.stickyNotes = roomData.boardState.stickyNotes.filter(n => n.id !== noteId);
        socket.to(currentRoom).emit("note-deleted", noteId);
      }
    }
  });

  // Template text events
  socket.on("template-text-add", (textData) => {
    if (currentRoom) {
      const room = activeRooms.get(currentRoom);
      if (room && room.users[socket.id]?.hasAccess) {
        if (!room.boardState.templateTexts) room.boardState.templateTexts = [];
        room.boardState.templateTexts.push(textData);
        socket.to(currentRoom).emit("template-text-added", textData); // Match client listener
      }
    }
  });

  socket.on("medical-stamp-add", (stampData) => {
    if (currentRoom) {
      const room = activeRooms.get(currentRoom);
      if (room && room.users[socket.id]?.hasAccess) {
        if (!room.boardState.medicalStamps) room.boardState.medicalStamps = [];
        room.boardState.medicalStamps.push(stampData);
        socket.to(currentRoom).emit("medical-stamp-sync", stampData);
      }
    }
  });

  socket.on("medical-stamp-move", (stampData) => {
    if (currentRoom) {
      const room = activeRooms.get(currentRoom);
      if (room && room.users[socket.id]?.hasAccess) {
        const idx = (room.boardState.medicalStamps || []).findIndex(s => s.id === stampData.id);
        if (idx !== -1) {
          room.boardState.medicalStamps[idx].x = stampData.x;
          room.boardState.medicalStamps[idx].y = stampData.y;
        }
        socket.to(currentRoom).emit("medical-stamp-moved", stampData);
      }
    }
  });

  socket.on("finance-stamp-add", (stampData) => {
    if (currentRoom) {
      const room = activeRooms.get(currentRoom);
      if (room && room.users[socket.id]?.hasAccess) {
        if (!room.boardState.financeStamps) room.boardState.financeStamps = [];
        room.boardState.financeStamps.push(stampData);
        socket.to(currentRoom).emit("finance-stamp-sync", stampData);
      }
    }
  });

  socket.on("finance-stamp-move", (stampData) => {
    if (currentRoom) {
      const room = activeRooms.get(currentRoom);
      if (room && room.users[socket.id]?.hasAccess) {
        const idx = (room.boardState.financeStamps || []).findIndex(s => s.id === stampData.id);
        if (idx !== -1) {
          room.boardState.financeStamps[idx].x = stampData.x;
          room.boardState.financeStamps[idx].y = stampData.y;
        }
        socket.to(currentRoom).emit("finance-stamp-moved", stampData);
      }
    }
  });

  socket.on("template-text-update", (updatedText) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        const idx = roomData.boardState.templateTexts.findIndex(t => t.id === updatedText.id);
        if (idx !== -1) {
          roomData.boardState.templateTexts[idx] = updatedText;
        }
        socket.to(currentRoom).emit("template-text-updated", updatedText);
      }
    }
  });

  socket.on("finance-field-update", (fieldData) => {
    if (currentRoom) {
      const room = activeRooms.get(currentRoom);
      if (room && room.users[socket.id]?.hasAccess) {
        if (!room.boardState.financeFields) room.boardState.financeFields = {};
        room.boardState.financeFields[fieldData.id] = fieldData.value;
        socket.to(currentRoom).emit("finance-field-sync", fieldData);
      }
    }
  });

  socket.on("template-text-delete", (textId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        roomData.boardState.templateTexts = roomData.boardState.templateTexts.filter(t => t.id !== textId);
        socket.to(currentRoom).emit("template-text-deleted", textId);
      }
    }
  });

  socket.on("finance-card-update", (cardData) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        if (!roomData.boardState.financeCards) roomData.boardState.financeCards = [];
        const idx = roomData.boardState.financeCards.findIndex(c => c.cardId === cardData.cardId);
        if (idx !== -1) {
          roomData.boardState.financeCards[idx] = cardData;
        } else {
          roomData.boardState.financeCards.push(cardData);
        }
        socket.to(currentRoom).emit("finance-card-sync", cardData);
      }
    }
  });

  socket.on("finance-card-delete", (cardId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        roomData.boardState.financeCards = (roomData.boardState.financeCards || []).filter(c => c.cardId !== cardId);
        socket.to(currentRoom).emit("finance-card-deleted", cardId);
      }
    }
  });

  socket.on("project-task-update", (taskData) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.hasAccess) {
        if (!roomData.boardState.projectTasks) roomData.boardState.projectTasks = [];
        const idx = roomData.boardState.projectTasks.findIndex(t => t.taskId === taskData.taskId);
        if (idx !== -1) {
          roomData.boardState.projectTasks[idx] = taskData;
        } else {
          roomData.boardState.projectTasks.push(taskData);
        }
        socket.to(currentRoom).emit("project-task-sync", taskData);
      }
    }
  });

  socket.on("project-task-delete", (taskId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        roomData.boardState.projectTasks = (roomData.boardState.projectTasks || []).filter(t => t.taskId !== taskId);
        socket.to(currentRoom).emit("project-task-deleted", taskId);
      }
    }
  });

  // Admin Actions
  socket.on("give-access", (targetUsername) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        // Find target user
        const targetSocketId = Object.keys(roomData.users).find(id => roomData.users[id].username === targetUsername);
        if (targetSocketId) {
          roomData.users[targetSocketId].hasAccess = true;
          // Notify target user
          io.to(targetSocketId).emit("permissions-updated", { hasAccess: true });
          // Notify everyone to refresh participant list
          io.to(currentRoom).emit("user-list-updated", Object.values(roomData.users));
        }
      }
    }
  });

  socket.on("revoke-access", (targetUsername) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        const targetSocketId = Object.keys(roomData.users).find(id => roomData.users[id].username === targetUsername);
        if (targetSocketId) {
          roomData.users[targetSocketId].hasAccess = false;
          // If they were drawing, release it
          if (roomData.currentDrawer === targetSocketId) {
            roomData.currentDrawer = null;
            io.to(currentRoom).emit("draw-released");
            io.to(currentRoom).emit("drawer-cleared");
          }
          // Notify target user
          io.to(targetSocketId).emit("permissions-updated", { hasAccess: false });
          // Notify everyone to refresh participant list
          io.to(currentRoom).emit("user-list-updated", Object.values(roomData.users));
        }
      }
    }
  });

  socket.on("kick-user", (targetUsername) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        // Find target user
        const targetSocketId = Object.keys(roomData.users).find(id => roomData.users[id].username === targetUsername);
        if (targetSocketId) {
          const adminUsername = roomData.users[socket.id]?.username || "the Administrator";
          // Notify target user they are kicked
          io.to(targetSocketId).emit("user-kicked", { by: adminUsername });
          // The disconnect event will handle cleanup
        }
      }
    }
  });

  // Template selection synchronization
  socket.on("template-select", (data) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        const key = typeof data === 'string' ? data : data.key;
        const transform = typeof data === 'string' ? null : data.transform;
        const isInstance = data.isInstance || false;

        if (isInstance) {
          if (!roomData.boardState.templateInstances) roomData.boardState.templateInstances = [];
          const newInstance = { id: 'inst-' + Date.now(), key, transform: transform || { x: 0, y: 0, scale: 1 } };
          roomData.boardState.templateInstances.push(newInstance);
          io.to(currentRoom).emit("template-instance-added", newInstance);
        } else {
          // Check if domain is changing (templateKey !== key)
          // If switching main template, clear ALL instances and their texts for a fresh start
          if (roomData.boardState.templateKey !== key) {
            console.log(`[SlateX] Domain switch in ${currentRoom}: ${roomData.boardState.templateKey} -> ${key}. Clearing all domain objects.`);

            // 1. Clear standard instances and ALL template texts
            roomData.boardState.templateInstances = [];
            roomData.boardState.templateTexts = [];

            // 2. Clear all domain-specific collections
            roomData.boardState.medicalStamps = [];
            roomData.boardState.financeStamps = [];
            roomData.boardState.financeCards = [];
            roomData.boardState.financeFields = {};
            roomData.boardState.projectTasks = [];

            // 3. Notify all users to clear their local domain states
            io.to(currentRoom).emit("clear-instances");
          }

          roomData.boardState.templateKey = key;
          roomData.boardState.templateTransform = transform || { x: 0, y: 0, scale: 1 };
          io.to(currentRoom).emit("template-selected", data);
        }
      }
    }
  });

  socket.on("template-instance-delete", (instanceId) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        roomData.boardState.templateInstances = (roomData.boardState.templateInstances || []).filter(inst => inst.id !== instanceId);
        // Also delete associated texts
        roomData.boardState.templateTexts = (roomData.boardState.templateTexts || []).filter(txt => txt.instanceId !== instanceId);
        socket.to(currentRoom).emit("template-instance-deleted", instanceId);
      }
    }
  });

  // Template transform events
  socket.on("template-transform-update", (data) => {
    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);
      if (roomData && roomData.users[socket.id]?.isAdmin) {
        const { id, transform } = data;
        if (id) {
          // Update specific instance
          const inst = (roomData.boardState.templateInstances || []).find(i => i.id === id);
          if (inst) inst.transform = transform;
          socket.to(currentRoom).emit("template-instance-transform-updated", data);
        } else {
          roomData.boardState.templateTransform = transform;
          socket.to(currentRoom).emit("template-transform-updated", transform);
        }
      }
    }
  });

  // Disconnect
  socket.on("disconnect", async (reason) => {
    console.log("User disconnected:", socket.id, "Reason:", reason);

    if (currentRoom) {
      const roomData = activeRooms.get(currentRoom);

      if (roomData) {
        // Release drawing permissions
        if (roomData.currentDrawer === socket.id) {
          roomData.currentDrawer = null;
          io.to(currentRoom).emit("draw-released");
          io.to(currentRoom).emit("drawer-cleared");
        }

        const userData = roomData.users[socket.id];
        const username = userData?.username;
        const userId = userData?.userId; // Get userId of disconnected user

        // Check if the disconnected user was the room creator
        const wasCreator = (userId && roomData.creatorId && String(userId) === String(roomData.creatorId));

        // Remove user
        delete roomData.users[socket.id];
        const remainingUsers = Object.values(roomData.users);

        // --- ADMIN TRANSFER LOGIC ---
        if (wasCreator && remainingUsers.length > 0) {
          // Find the new admin: the first user in the remaining list
          const newAdminData = remainingUsers[0];

          // Find the socket ID of the new admin
          const newAdminSocketId = Object.keys(roomData.users).find(
            (sId) => roomData.users[sId].userId === newAdminData.userId
          );

          if (newAdminSocketId) {
            roomData.users[newAdminSocketId].isAdmin = true;
            roomData.users[newAdminSocketId].hasAccess = true; // New admin always has access

            console.log(`[SlateX] Admin transfer: ${username} (creator) left. ${newAdminData.username} (Socket ${newAdminSocketId}) is new admin.`);

            // 1. Notify the new admin client-side
            io.to(newAdminSocketId).emit("user-permissions", { isAdmin: true, hasAccess: true });

            // 2. Update the creator in the MongoDB Room document for persistence
            const Room = require('./models/Room');
            const mongoose = require('mongoose'); // Require mongoose here
            const room = await Room.findOne({ roomId: currentRoom });
            if (room) {
              room.creator = new mongoose.Types.ObjectId(newAdminData.userId); // Convert to ObjectId
              await room.save();
              roomData.creatorId = newAdminData.userId; // Update in-memory creatorId
              roomData.creatorUsername = newAdminData.username; // Update in-memory creatorUsername
              console.log(`[SlateX] MongoDB Room ${currentRoom} creator updated to ${newAdminData.username}`);
            }
          }
        }
        // --- END ADMIN TRANSFER LOG ---

        // Notify room of user departure and any admin changes
        io.to(currentRoom).emit("user-left", {
          username,
          users: Object.values(roomData.users)
        });

        // NOTE: Save is now handled explicitly via API call on room exit
        // No auto-save on disconnect per requirements

        // Clean up empty rooms
        if (Object.keys(roomData.users).length === 0) {
          activeRooms.delete(currentRoom);
          console.log(`Room ${currentRoom} cleaned up (empty)`);
        }
      }
    }
  });
});

// =======================
// 🚀 START SERVER
// =======================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});