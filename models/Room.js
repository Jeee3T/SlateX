
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  password: {
    type: String,
    required: true,
    minlength: 4
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  boardState: {
    paths: {
      type: Array,
      default: []
    },
    shapes: {
      type: Array,
      default: []
    },
    textElements: {
      type: Array,
      default: []
    },
    stickyNotes: {
      type: Array,
      default: []
    },
    templateTexts: {
      type: Array,
      default: []
    },
    templateTransform: {
      type: Object,
      default: { x: 0, y: 0, scale: 1 }
    },
    templateKey: {
      type: String,
      default: null
    }
  },
  template: {
    type: String,
    enum: ['coding', 'medical', 'finance', 'project', 'brainstorm'],
    default: 'brainstorm'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  previewImage: {
    type: String,  // base64 encoded PNG
    default: null
  },
  lastOpenedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  timeSpent: {
    type: Number, // Total minutes spent
    default: 0
  }
});

// Hash password before saving
// Hash password before saving
roomSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
roomSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update last activity
roomSchema.methods.updateActivity = function () {
  this.lastOpenedAt = new Date();
  return this.save();
};

// Add participant to room
roomSchema.methods.addParticipant = function (userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Remove participant from room
roomSchema.methods.removeParticipant = function (userId) {
  this.participants = this.participants.filter(
    id => id.toString() !== userId.toString()
  );
  return this.save();
};

// Update board state
roomSchema.methods.updateBoardState = function (boardState) {
  this.boardState = { ...this.boardState, ...boardState };
  this.lastOpenedAt = new Date();
  return this.save();
};

// Save full room state on exit (for room owner only)
roomSchema.methods.saveOnExit = function (canvasState, previewImage) {
  this.boardState = canvasState;
  this.previewImage = previewImage;

  // Calculate duration of this session (since lastOpenedAt)
  const now = new Date();
  const lastOpened = this.lastOpenedAt || now;
  const durationMs = now.getTime() - lastOpened.getTime();
  const durationMinutes = Math.max(0, Math.floor(durationMs / 60000));

  // Accumulate time (if session was reasonably long, e.g. < 24 hours to avoid anomalies)
  if (durationMinutes < 1440) {
    this.timeSpent = (this.timeSpent || 0) + durationMinutes;
  }

  this.lastOpenedAt = now;
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema);