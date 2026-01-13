 
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
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
roomSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
roomSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update last activity
roomSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Add participant to room
roomSchema.methods.addParticipant = function(userId) {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    return this.save();
  }
  return Promise.resolve(this);
};

// Remove participant from room
roomSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(
    id => id.toString() !== userId.toString()
  );
  return this.save();
};

// Update board state
roomSchema.methods.updateBoardState = function(boardState) {
  this.boardState = { ...this.boardState, ...boardState };
  this.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema);