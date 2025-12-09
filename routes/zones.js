const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');

// Get all zones
router.get('/', async (req, res) => {
  try {
    const zones = await Zone.find().sort({ zoneNumber: 1 });
    res.json({
      success: true,
      data: zones,
      message: 'Zones fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching zones',
      error: error.message
    });
  }
});

// Get single zone
router.get('/:id', async (req, res) => {
  try {
    const zone = await Zone.findById(req.params.id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }
    res.json({
      success: true,
      data: zone,
      message: 'Zone fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching zone',
      error: error.message
    });
  }
});

// Create new zone
router.post('/', async (req, res) => {
  try {
    const { name, description, supervisor, contactNumber, notes, zoneNumber, code, status } = req.body;

    // Validate required fields
    if (!name || !zoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Zone name and number are required'
      });
    }

    // Check if zone number already exists
    const existingZone = await Zone.findOne({ zoneNumber });
    if (existingZone) {
      return res.status(400).json({
        success: false,
        message: 'Zone number already exists'
      });
    }

    const zone = new Zone({
      name,
      description: description || '',
      supervisor: supervisor || '',
      contactNumber: contactNumber || '',
      notes: notes || '',
      zoneNumber,
      code: code || `ZONE${String(zoneNumber).padStart(3, '0')}`,
      status: status || 'active'
    });

    const savedZone = await zone.save();

    res.status(201).json({
      success: true,
      data: savedZone,
      message: 'Zone created successfully'
    });
  } catch (error) {
    console.error('Error creating zone:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating zone',
      error: error.message
    });
  }
});

// Update zone
router.put('/:id', async (req, res) => {
  try {
    const { name, description, supervisor, contactNumber, notes, status } = req.body;

    const zone = await Zone.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        supervisor,
        contactNumber,
        notes,
        status
      },
      { new: true, runValidators: true }
    );

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    res.json({
      success: true,
      data: zone,
      message: 'Zone updated successfully'
    });
  } catch (error) {
    console.error('Error updating zone:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating zone',
      error: error.message
    });
  }
});

// Delete zone
router.delete('/:id', async (req, res) => {
  try {
    const zone = await Zone.findByIdAndDelete(req.params.id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    res.json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting zone',
      error: error.message
    });
  }
});

module.exports = router;