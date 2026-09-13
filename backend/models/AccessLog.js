const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  user_name: { type: String },
  camera_id: { type: String },
  confidence: { type: Number },
  access_status: { type: String },
  snapshot: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('AccessLog', logSchema);
