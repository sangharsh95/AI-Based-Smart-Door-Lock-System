const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AccessLog = require('../models/AccessLog');
const { findBestMatch } = require('../utils/faceMath');
const mqtt = require('mqtt');

const mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883');
mqttClient.on('connect', () => console.log('MQTT Connected'));

function triggerDoorUnlock(userName, isPanic = false) {
  const payload = JSON.stringify({ action: 'unlock', user: userName, timestamp: new Date().toISOString(), panic: isPanic });
  mqttClient.publish('btech/smarthome/door/unlock', payload);
  console.log(`Door unlocked for ${userName} (Panic: ${isPanic})`);
}

// Check if current time is within user's allowed schedule
function isWithinSchedule(startStr, endStr) {
  if (!startStr || !endStr) return true;
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const parseTime = (str) => {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
  };
  
  const start = parseTime(startStr);
  const end = parseTime(endStr);
  
  return currentMinutes >= start && currentMinutes <= end;
}

// 1. Initial Verification (Face)
router.post('/', async (req, res) => {
  try {
    const { embedding } = req.body;
    if (!embedding || embedding.length !== 128) return res.status(400).json({ error: 'Invalid' });

    const allUsers = await User.find({});
    const { user: matchedUser, confidence } = findBestMatch(embedding, allUsers);

    let access_status = "Denied - Unknown";

    if (matchedUser) {
      if (matchedUser.admin_approved) {
        
        // Check Expiry
        let is_expired = false;
        if (matchedUser.access_expires_at && new Date() > matchedUser.access_expires_at) {
          is_expired = true;
        }

        // Check Daily Schedule
        const isScheduled = isWithinSchedule(matchedUser.allowed_start_time, matchedUser.allowed_end_time);

        if (is_expired) {
          access_status = "Denied - Expired";
        } else if (!isScheduled) {
          access_status = "Denied - Outside Schedule";
        } else {
          access_status = "Granted"; // Passed face check!
        }
      } else {
        access_status = "Denied - Unapproved";
      }
    }

    res.json({
      access: access_status,
      user_id: matchedUser ? matchedUser._id : null,
      user_name: matchedUser ? matchedUser.name : "Unknown",
      confidence: confidence
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Liveness Verified -> Generate OTP
router.post('/init-otp', async (req, res) => {
  try {
    const { user_id } = req.body;
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.current_otp = otp;
    user.otp_expires_at = new Date(Date.now() + 5 * 60000); // 5 minutes
    await user.save();

    // SIMULATE SENDING EMAIL/SMS
    console.log(`\n======================================`);
    console.log(`🔒 [2FA OTP GENERATED] -> Sent to ${user.email || user.mobile}`);
    console.log(`🔑 OTP CODE: ${otp}`);
    console.log(`======================================\n`);

    res.json({ success: true, message: "OTP Sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Final Unlock (OTP + Panic Check)
router.post('/unlock', async (req, res) => {
  try {
    const { user_id, confidence, otp, panic } = req.body;
    const user = await User.findById(user_id);
    const io = req.app.get('io');
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If panic mode, we ignore OTP and open door immediately but silently alert Admin!
    if (panic) {
      triggerDoorUnlock(user.name, true);
      const log = await AccessLog.create({
        user_id: user._id, user_name: user.name, camera_id: "react_webcam", confidence,
        access_status: "THREAT DETECTED - PANIC ALARM", snapshot: "fear_detected"
      });
      io.emit('new_log', log);
      io.emit('panic_alarm', log);
      return res.json({ success: true, is_panic: true });
    }

    // Normal OTP Validation
    if (!user.current_otp || user.current_otp !== otp) {
      const log = await AccessLog.create({
        user_id: user._id, user_name: user.name, camera_id: "react_webcam", confidence,
        access_status: "Denied - Invalid OTP", snapshot: "failed_2fa"
      });
      io.emit('new_log', log);
      return res.json({ success: false, error: 'Invalid OTP' });
    }

    // Check OTP Expiry
    if (new Date() > user.otp_expires_at) {
      return res.json({ success: false, error: 'OTP Expired' });
    }

    // Success! Clear OTP and unlock
    user.current_otp = null;
    await user.save();
    triggerDoorUnlock(user.name);

    const log = await AccessLog.create({
      user_id: user._id, user_name: user.name, camera_id: "react_webcam", confidence,
      access_status: "Granted - 2FA Verified", snapshot: "success"
    });
    
    io.emit('new_log', log);
    res.json({ success: true });
    
  } catch (error) {
    res.status(500).json({ error: 'Unlock failed' });
  }
});

module.exports = router;
