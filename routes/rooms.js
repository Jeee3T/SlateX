// ============================================
// FILE: /routes/rooms.js
// Updated to use MongoDB
// ============================================

const express = require('express');
const router = express.Router();
const Room = require('../models/Room');

// Create a new room
router.post('/create', async (req, res) => {
  try {
    const { roomId, name, password } = req.body;

    // Validate input
    if (!roomId || !name || !password) {
      return res.json({
        success: false,
        message: 'Room ID, name, and password are required'
      });
    }

    if (password.length < 4) {
      return res.json({
        success: false,
        message: 'Password must be at least 4 characters'
      });
    }

    // Check if room ID already exists
    const existingRoom = await Room.findOne({ roomId: roomId.toUpperCase() });
    if (existingRoom) {
      return res.json({
        success: false,
        message: 'Room ID already exists. Please try again.'
      });
    }

    // Create new room
    const room = await Room.create({
      roomId: roomId.toUpperCase(),
      name: name,
      password: password,
      displayPassword: password,
      creator: req.session.userId,
      participants: [req.session.userId]
    });

    res.json({
      success: true,
      room: {
        id: room.roomId,
        name: room.name,
        createdAt: room.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating room detailed:', error);
    console.error('Stack:', error.stack);
    res.json({
      success: false,
      message: error.message || 'Failed to create room'
    });
  }
});

// Join an existing room
router.post('/join', async (req, res) => {
  try {
    const { roomId, password } = req.body;

    // Validate input
    if (!roomId || !password) {
      return res.json({
        success: false,
        message: 'Room ID and password are required'
      });
    }

    // Find room
    const room = await Room.findOne({ roomId: roomId.toUpperCase() });
    if (!room) {
      return res.json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if room is active
    if (!room.isActive) {
      return res.json({
        success: false,
        message: 'This room has been closed'
      });
    }

    // Verify password
    const isValidPassword = await room.comparePassword(password);
    if (!isValidPassword) {
      return res.json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Add user to participants
    await room.addParticipant(req.session.userId);

    res.json({
      success: true,
      room: {
        id: room.roomId,
        name: room.name,
        createdAt: room.createdAt,
        template: room.template
      }
    });

  } catch (error) {
    console.error('Error joining room:', error);
    res.json({
      success: false,
      message: 'Failed to join room'
    });
  }
});

// Get room info (for reconnection)
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId: roomId.toUpperCase() })
      .populate('creator', 'username')
      .populate('participants', 'username');

    if (!room) {
      return res.json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is a participant
    const isParticipant = room.participants.some(
      p => p._id.toString() === req.session.userId
    );

    if (!isParticipant) {
      return res.json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      room: {
        id: room.roomId,
        name: room.name,
        creator: room.creator.username,
        participants: room.participants.map(p => p.username),
        participantCount: room.participants.length,
        boardState: room.boardState,
        template: room.template,
        displayPassword: room.displayPassword || '',
        createdAt: room.createdAt,
        lastOpenedAt: room.lastOpenedAt
      }
    });

  } catch (error) {
    console.error('Error fetching room:', error);
    res.json({
      success: false,
      message: 'Failed to fetch room'
    });
  }
});

// Get user's rooms
router.get('/user/list', async (req, res) => {
  try {
    const userId = req.session.userId;

    // Find all rooms where user is a participant and has a preview image (not a "false" blank room)
    const rooms = await Room.find({
      participants: userId,
      isActive: true,
      previewImage: { $ne: null }
    })
      .populate('creator', 'username')
      .sort({ lastOpenedAt: -1 })
      .limit(5);

    const roomsList = rooms.map(room => ({
      id: room.roomId,
      name: room.name,
      creator: room.creator.username,
      isOwner: room.creator._id.toString() === userId?.toString(),
      participants: room.participants.length,
      template: room.template,
      previewImage: room.previewImage,
      timeSpent: room.timeSpent || 0, // Minutes
      displayPassword: room.displayPassword || '',
      createdAt: room.createdAt,
      lastOpenedAt: room.lastOpenedAt
    }));

    res.json({
      success: true,
      rooms: roomsList
    });

  } catch (error) {
    console.error('Error fetching user rooms:', error);
    res.json({
      success: false,
      message: 'Failed to fetch rooms'
    });
  }
});

// Update room board state
router.put('/:roomId/board', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { boardState } = req.body;

    const room = await Room.findOne({ roomId: roomId.toUpperCase() });

    if (!room) {
      return res.json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is a participant
    if (!room.participants.includes(req.session.userId)) {
      return res.json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update board state
    await room.updateBoardState(boardState);

    res.json({
      success: true,
      message: 'Board state updated'
    });

  } catch (error) {
    console.error('Error updating board state:', error);
    res.json({
      success: false,
      message: 'Failed to update board state'
    });
  }
});

// Save room state on exit (owner only)
router.post('/:roomId/save-on-exit', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { canvasState, previewImage } = req.body;

    // Find room
    const room = await Room.findOne({ roomId: roomId.toUpperCase() });

    if (!room) {
      return res.json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is the room creator (only owner can save)
    if (room.creator.toString() !== req.session.userId) {
      return res.json({
        success: false,
        message: 'Only the room owner can save the canvas state'
      });
    }

    // Validate payload
    if (!canvasState) {
      return res.json({
        success: false,
        message: 'Canvas state is required'
      });
    }

    console.log(`[DEBUG] save-on-exit called for ${roomId}`);
    console.log(`[DEBUG] Received canvasState:`, {
      paths: canvasState.paths?.length || 0,
      shapes: canvasState.shapes?.length || 0,
      templateKey: canvasState.templateKey
    });

    // Save full room state
    await room.saveOnExit(canvasState, previewImage);

    console.log(`[DEBUG] Saved to database for ${roomId}`);

    res.json({
      success: true,
      message: 'Room state saved successfully'
    });

  } catch (error) {
    console.error('Error saving room state on exit:', error);
    res.json({
      success: false,
      message: 'Failed to save room state'
    });
  }
});

// Leave room
router.post('/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId: roomId.toUpperCase() });

    if (!room) {
      return res.json({
        success: false,
        message: 'Room not found'
      });
    }

    await room.removeParticipant(req.session.userId);

    res.json({
      success: true,
      message: 'Left room successfully'
    });

  } catch (error) {
    console.error('Error leaving room:', error);
    res.json({
      success: false,
      message: 'Failed to leave room'
    });
  }
});

// Delete room (only creator can delete)
router.delete('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId: roomId.toUpperCase() });

    if (!room) {
      return res.json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is the creator
    if (room.creator.toString() !== req.session.userId) {
      return res.json({
        success: false,
        message: 'Only the room creator can delete the room'
      });
    }

    // Soft delete - mark as inactive
    room.isActive = false;
    await room.save();

    res.json({
      success: true,
      message: 'Room deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting room:', error);
    res.json({
      success: false,
      message: 'Failed to delete room'
    });
  }
});

// Rename room (only creator can rename)
router.put('/:roomId/rename', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.json({
        success: false,
        message: 'Room name cannot be empty'
      });
    }

    const room = await Room.findOne({ roomId: roomId.toUpperCase() });

    if (!room) {
      return res.json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is the creator
    if (room.creator.toString() !== req.session.userId) {
      return res.json({
        success: false,
        message: 'Only the room creator can rename the room'
      });
    }

    room.name = name.trim();
    await room.save();

    res.json({
      success: true,
      message: 'Room renamed successfully',
      name: room.name
    });

  } catch (error) {
    console.error('Error renaming room:', error);
    res.json({
      success: false,
      message: 'Failed to rename room'
    });
  }
});

module.exports = router;