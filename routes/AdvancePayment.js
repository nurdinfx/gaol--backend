const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // THIS WAS MISSING - CRITICAL FIX
const AdvancePayment = require('../models/AdvancePayment');
const Worker = require('../models/Worker');

// Get all advance payments
router.get('/', async (req, res) => {
  try {
    const payments = await AdvancePayment.find()
      .populate('workerId', 'fullName workerId phoneNumber')
      .sort({ date: -1, createdAt: -1 });
    
    res.json({
      success: true,
      data: payments,
      message: 'Advance payments fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching advance payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching advance payments',
      error: error.message
    });
  }
});

// Get advance payments for a specific worker
router.get('/worker/:workerId', async (req, res) => {
  try {
    const { workerId } = req.params;
    
    // Validate workerId format
    if (!mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker ID format'
      });
    }
    
    const payments = await AdvancePayment.find({ workerId })
      .populate('workerId', 'fullName workerId phoneNumber')
      .sort({ date: -1, createdAt: -1 });
    
    res.json({
      success: true,
      data: payments,
      message: 'Worker advance payments fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching worker advance payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching worker advance payments',
      error: error.message
    });
  }
});

// Create new advance payment
router.post('/', async (req, res) => {
  try {
    const { workerId, amount, description, date, type, category } = req.body;

    // Validate required fields
    if (!workerId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Worker ID and amount are required'
      });
    }

    // Validate workerId format
    if (!mongoose.Types.ObjectId.isValid(workerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid worker ID format'
      });
    }

    // Check if worker exists
    const worker = await Worker.findById(workerId);
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Create advance payment
    const advancePayment = new AdvancePayment({
      workerId,
      amount: paymentAmount,
      description: description || 'Advance payment',
      date: date ? new Date(date) : new Date(),
      type: type || 'advance',
      category: category || 'general'
    });

    const savedPayment = await advancePayment.save();

    // Populate worker details for response
    await savedPayment.populate('workerId', 'fullName workerId phoneNumber');

    res.status(201).json({
      success: true,
      data: savedPayment,
      message: 'Advance payment created successfully'
    });
  } catch (error) {
    console.error('Error creating advance payment:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating advance payment',
      error: error.message
    });
  }
});

// Update advance payment
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, date, type, category } = req.body;

    // Validate payment ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID format'
      });
    }

    const updateData = {};
    if (amount) updateData.amount = parseFloat(amount);
    if (description) updateData.description = description;
    if (date) updateData.date = new Date(date);
    if (type) updateData.type = type;
    if (category) updateData.category = category;

    const advancePayment = await AdvancePayment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('workerId', 'fullName workerId phoneNumber');

    if (!advancePayment) {
      return res.status(404).json({
        success: false,
        message: 'Advance payment not found'
      });
    }

    res.json({
      success: true,
      data: advancePayment,
      message: 'Advance payment updated successfully'
    });
  } catch (error) {
    console.error('Error updating advance payment:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating advance payment',
      error: error.message
    });
  }
});

// Delete advance payment
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate payment ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID format'
      });
    }

    const advancePayment = await AdvancePayment.findByIdAndDelete(id);

    if (!advancePayment) {
      return res.status(404).json({
        success: false,
        message: 'Advance payment not found'
      });
    }

    res.json({
      success: true,
      message: 'Advance payment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting advance payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting advance payment',
      error: error.message
    });
  }
});

module.exports = router;