const express = require('express');
const Driver = require('../models/Driver');
const router = express.Router();

// Get all drivers
router.get('/', async (req, res) => {
  try {
    const drivers = await Driver.find({ isActive: true });
    res.json({ 
      success: true, 
      data: drivers,
      message: 'Drivers fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching drivers',
      error: error.message 
    });
  }
});

module.exports = router;