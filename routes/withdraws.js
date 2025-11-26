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
    const { status, search } = req.query;
    let filter = {};
    
    if (status && status !== 'all') {
      filter.status = status;
    }
    
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { 'bankDetails.bankName': { $regex: search, $options: 'i' } }
      ];
    }

    const withdrawals = await Withdraw.find(filter)
      .populate('createdBy', 'name username')
      .populate('approvedBy', 'name username')
      .sort({ createdAt: -1 });

    // FIX: Return data directly as array (matching frontend expectation)
    res.json(withdrawals); // Changed from {success: true, data: withdrawals}
    
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
    
    const totalWithdrawn = withdrawals
      .filter(w => w.status === 'completed')
      .reduce((sum, w) => sum + w.amount, 0);
    
    const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
    const approvedCount = withdrawals.filter(w => w.status === 'approved').length;
    const completedCount = withdrawals.filter(w => w.status === 'completed').length;
    const rejectedCount = withdrawals.filter(w => w.status === 'rejected').length;

    res.json({
      success: true,
      data: {
        totalWithdrawn,
        pendingCount,
        approvedCount,
        completedCount,
        rejectedCount
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
    const {
      amount,
      description,
      category,
      withdrawDate,
      bankDetails,
      notes,
      status = 'pending'
    } = req.body;

    console.log('Creating withdrawal with data:', req.body);

    // Validate required fields
    if (!amount || !description || !category || !bankDetails?.bankName || !bankDetails?.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amount, description, category, bankName, accountNumber'
      });
    }

    // FIX: Generate account holder if not provided (frontend removed this field)
    const accountHolder = bankDetails.accountHolder || `Account ${bankDetails.accountNumber.slice(-4)}`;

    const withdrawalData = {
      amount: parseFloat(amount),
      description,
      category,
      withdrawDate: withdrawDate ? new Date(withdrawDate) : new Date(),
      bankDetails: {
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        accountHolder: accountHolder, // Auto-generate if missing
        branch: bankDetails.branch || 'Main Branch'
      },
      notes: notes || '',
      status,
      createdBy: req.user._id
    };

    const withdrawal = new Withdraw(withdrawalData);
    await withdrawal.save();

    // Populate the createdBy field
    await withdrawal.populate('createdBy', 'name username');

    // FIX: Return proper response format that frontend expects
    res.status(201).json({
      success: true,
      data: withdrawal, // Frontend expects result.data
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
    const {
      amount,
      description,
      category,
      withdrawDate,
      bankDetails,
      notes,
      status
    } = req.body;

    const updateData = {};
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (withdrawDate !== undefined) updateData.withdrawDate = new Date(withdrawDate);
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

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
    ).populate('createdBy', 'name username')
     .populate('approvedBy', 'name username');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    // FIX: Return proper response format
    res.json({
      success: true,
      data: withdrawal, // Frontend expects result.data
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

// Update withdrawal status - FIXED RESPONSE FORMAT
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required: pending, approved, rejected, or completed'
      });
    }

    const updateData = { status };
    
    if (status === 'approved' || status === 'completed') {
      updateData.approvedBy = req.user._id;
      updateData.approvedDate = new Date();
    }

    const withdrawal = await Withdraw.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name username')
     .populate('approvedBy', 'name username');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    // FIX: Return proper response format
    res.json({
      success: true,
      data: withdrawal, // Frontend expects result.data
      message: `Withdrawal status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating withdrawal status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating withdrawal status',
      error: error.message
    });
  }
});

// Delete withdrawal - FIXED RESPONSE FORMAT
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const withdrawal = await Withdraw.findByIdAndDelete(id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    // FIX: Return proper response format
    res.json({
      success: true,
      data: withdrawal, // Frontend expects result.data
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
      .populate('createdBy', 'name username')
      .populate('approvedBy', 'name username');

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal not found'
      });
    }

    // FIX: Return proper response format
    res.json({
      success: true,
      data: withdrawal, // Frontend expects result.data
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