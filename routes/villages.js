const express = require('express');
const Village = require('../models/Village');
const router = express.Router();

const makeCodeFromName = (name) => {
  const base = String(name || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `VIL-${base}`.slice(0, 24);
};

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

// Create a village (name-only input supported)
router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Village name is required' });
    }

    const existingByName = await Village.findOne({ name });
    if (existingByName) {
      return res.status(409).json({ success: false, message: 'Village name already exists' });
    }

    let code = makeCodeFromName(name);
    let suffix = 1;
    while (await Village.findOne({ code })) {
      code = `${makeCodeFromName(name)}-${suffix++}`.slice(0, 24);
    }

    const village = await Village.create({
      name,
      code,
      location: 'Unknown',
      monthlyFee: 0,
      status: 'active'
    });

    res.status(201).json({ success: true, data: village, message: 'Village created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating village', error: error.message });
  }
});

// Update village (rename supported)
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates = {};

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Village name cannot be empty' });
      }
      const conflict = await Village.findOne({ name, _id: { $ne: id } });
      if (conflict) {
        return res.status(409).json({ success: false, message: 'Village name already exists' });
      }
      updates.name = name;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await Village.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Village not found' });
    }
    res.json({ success: true, data: updated, message: 'Village updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating village', error: error.message });
  }
});

// Delete village
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Village.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Village not found' });
    }
    res.json({ success: true, message: 'Village deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting village', error: error.message });
  }
});

module.exports = router;
