const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('./admin');

// Public: Register
router.post('/register', async (req, res) => {
  try {
    const { name, mobile, email, address, purpose, embeddings, images_json, profile_image } = req.body;
    
    if (!name || !mobile || !embeddings) {
      return res.status(400).json({ detail: "Missing required fields" });
    }

    const phone_email = name.toLowerCase().replace(/\s/g, '') + '@smartlock.local';

    const newUser = new User({
      name, mobile, email, address, purpose, phone_email,
      embeddings, images_json, profile_image,
      registration_status: 'pending',
      admin_approved: false
    });

    await newUser.save();
    
    // Emit real-time event to Admin
    req.app.get('io').emit('new_user', newUser);

    res.json({ message: "Registration submitted successfully" });
  } catch (error) {
    res.status(500).json({ detail: "Registration failed: " + error.message });
  }
});

// Protected: Admin List
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({}).sort('-createdAt');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected: Admin Approve
router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { name, expires_in_minutes, allowed_start_time, allowed_end_time } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.admin_approved = true;
    user.registration_status = 'approved';
    if (name) user.name = name;
    
    if (expires_in_minutes > 0) {
      user.access_expires_at = new Date(Date.now() + expires_in_minutes * 60000);
    } else {
      user.access_expires_at = null; // Never expire
    }

    if (allowed_start_time) user.allowed_start_time = allowed_start_time;
    if (allowed_end_time) user.allowed_end_time = allowed_end_time;

    await user.save();
    
    // Emit real-time update
    req.app.get('io').emit('user_updated', user);

    res.json({ message: "User approved successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected: Admin Delete
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    req.app.get('io').emit('user_deleted', req.params.id);
    res.json({ message: "User deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
