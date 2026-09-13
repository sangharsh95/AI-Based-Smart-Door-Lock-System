const express = require('express');
const router = express.Router();
const AccessLog = require('../models/AccessLog');
const { authMiddleware } = require('./admin');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const logs = await AccessLog.find({}).sort('-createdAt').limit(50);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
