const express = require('express');
const Withdraw = require('../models/Withdraw');
const router = express.Router();

// Middleware to simulate authentication
const authMiddleware = (req, res, next) => {
  req.user = { _id: '65d8f1a9e4b0d8a9c8f7b123' };
  next();
};

router.use(authMiddleware);

// Get all withdrawals - FIXED RESPONSE FORMAT
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let filter = {};
    
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { 'bankDetails.bankName': { $regex: search, $options: 'i' } }
      ];
    }

    const withdrawals = await Withdraw.find(filter)
      .populate('createdBy', 'name username')
      .sort({ createdAt: -1 });

    // FIX: Return data directly as array (matching frontend expectation)
    res.json(withdrawals);
    
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching withdrawals',
      error: error.message 
    });
  }
});

// Get withdrawal statistics - FIXED
router.get('/stats', async (req, res) => {
  try {
    const withdrawals = await Withdraw.find();
    
    const totalWithdrawn = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalCount = withdrawals.length;

    res.json({
      success: true,
      data: {
        totalWithdrawn,
        totalCount
      },
      message: 'Withdrawal stats fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching withdrawal stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawal stats',
      error: error.message
    });
  }
});

// Create new withdrawal - FIXED ACCOUNT HOLDER ISSUE
router.post('/', async (req, res) => {
  try {
    const { amount, description, withdrawDate, bankDetails, notes } = req.body;

    console.log('Creating withdrawal with data:', req.body);

    // Validate required fields
    if (!amount || !description || !bankDetails?.bankName || !bankDetails?.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, description, bankName, accountNumber'
      });
    }

    // FIX: Generate account holder if not provided (frontend removed this field)
    const accountHolder = bankDetails.accountHolder || `Account ${bankDetails.accountNumber.slice(-4)}`;

    const withdrawalData = {
      amount: parseFloat(amount),
      description,
      withdrawDate: withdrawDate ? new Date(withdrawDate) : new Date(),
      bankDetails: {
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        accountHolder: accountHolder,
        branch: bankDetails.branch || 'Main Branch'
      },
      notes: notes || '',
      createdBy: req.user._id
    };

    const withdrawal = new Withdraw(withdrawalData);
    await withdrawal.save();

    // Populate the createdBy field
    await withdrawal.populate('createdBy', 'name username');

    res.status(201).json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal created successfully'
    });
    
  } catch (error) {
    console.error('Error creating withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating withdrawal',
      error: error.message
    });
  }
});

// Update withdrawal - FIXED RESPONSE FORMAT
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description, withdrawDate, bankDetails, notes } = req.body;

    const updateData = {};
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (description !== undefined) updateData.description = description;
    if (withdrawDate !== undefined) updateData.withdrawDate = new Date(withdrawDate);
    if (notes !== undefined) updateData.notes = notes;

    if (bankDetails) {
      updateData.bankDetails = {};
      if (bankDetails.bankName !== undefined) updateData.bankDetails.bankName = bankDetails.bankName;
      if (bankDetails.accountNumber !== undefined) updateData.bankDetails.accountNumber = bankDetails.accountNumber;
      if (bankDetails.accountHolder !== undefined) {
        updateData.bankDetails.accountHolder = bankDetails.accountHolder;
      } else {
        // Auto-generate account holder if not provided
        updateData.bankDetails.accountHolder = `Account ${bankDetails.accountNumber?.slice(-4) || '0000'}`;
      }
      if (bankDetails.branch !== undefined) updateData.bankDetails.branch = bankDetails.branch;
    }

    const withdrawal = await Withdraw.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name username');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    res.json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal updated successfully'
    });
  } catch (error) {
    console.error('Error updating withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating withdrawal',
      error: error.message
    });
  }
});

// Delete withdrawal - FIXED RESPONSE FORMAT
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Attempting to delete withdrawal with ID:', id);

    const withdrawal = await Withdraw.findByIdAndDelete(id);

    if (!withdrawal) {
      console.log('Withdrawal not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    console.log('Successfully deleted withdrawal:', withdrawal._id);
    res.json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting withdrawal',
      error: error.message
    });
  }
});

// Get single withdrawal - FIXED RESPONSE FORMAT
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawal = await Withdraw.findById(id)
      .populate('createdBy', 'name username');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    res.json({
      success: true,
      data: withdrawal,
      message: 'Withdrawal fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching withdrawal:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawal',
      error: error.message
    });
  }
});

module.exports = router;
