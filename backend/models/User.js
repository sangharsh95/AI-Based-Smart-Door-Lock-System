const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  email: String,
  address: String,
  purpose: String,
  phone_email: String,
  
  // Biometrics
  embeddings: [Number],
  images_json: String,
  profile_image: String,

  // Status
  registration_status: { type: String, default: 'pending' },
  admin_approved: { type: Boolean, default: false },
  access_expires_at: { type: Date, default: null },

  // Scheduling Rules
  allowed_start_time: { type: String, default: '00:00' }, // HH:mm
  allowed_end_time: { type: String, default: '23:59' },   // HH:mm

  // 2FA Security
  current_otp: { type: String, default: null },
  otp_expires_at: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
