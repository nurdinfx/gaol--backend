const express = require('express');
const Village = require('../models/Village');
const router = express.Router();

// Get all villages
router.get('/', async (req, res) => {
  try {
    const villages = await Village.find();
    res.json({ 
      success: true, 
      data: villages,
      message: 'Villages fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching villages',
      error: error.message 
    });
  }
});

module.exports = router;