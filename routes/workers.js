const express = require('express');
const router = express.Router();
const Worker = require('../models/Worker'); // Make sure this path is correct

// Get all workers
router.get('/', async (req, res) => {
  try {
    const workers = await Worker.find();
    res.json({
      success: true,
      data: workers,
      message: 'Workers fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workers',
      error: error.message
    });
  }
});

// Create new worker
router.post('/', async (req, res) => {
  try {
    const worker = new Worker(req.body);
    await worker.save();
    res.status(201).json({
      success: true,
      data: worker,
      message: 'Worker created successfully'
    });
  } catch (error) {
    console.error('Error creating worker:', error);
    res.status(400).json({
      success: false,
      message: 'Error creating worker',
      error: error.message
    });
  }
});

// Get worker expenses
router.get('/:workerId/expenses', async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.workerId).select('expenses fullName');
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    res.json({
      success: true,
      data: worker.expenses || [],
      message: 'Worker expenses fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching worker expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching worker expenses',
      error: error.message
    });
  }
});

// Add worker expense
router.post('/:workerId/expenses', async (req, res) => {
  try {
    const { amount, description, category, date } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid expense amount is required'
      });
    }

    const worker = await Worker.findById(req.params.workerId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const expense = {
      amount: Number(amount),
      description: description?.trim() || 'Expense',
      category: category || 'other',
      date: date ? new Date(date) : new Date(),
      createdAt: new Date()
    };

    worker.expenses.push(expense);
    await worker.save();

    const createdExpense = worker.expenses[worker.expenses.length - 1];

    res.status(201).json({
      success: true,
      data: createdExpense,
      message: 'Worker expense recorded successfully'
    });
  } catch (error) {
    console.error('Error creating worker expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating worker expense',
      error: error.message
    });
  }
});

// Delete worker expense
router.delete('/:workerId/expenses/:expenseId', async (req, res) => {
  try {
    const { workerId, expenseId } = req.params;
    const worker = await Worker.findById(workerId);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }

    const expenseIndex = worker.expenses.findIndex(expense => expense._id.toString() === expenseId);

    if (expenseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Worker expense not found'
      });
    }

    worker.expenses.splice(expenseIndex, 1);
    await worker.save();

    res.json({
      success: true,
      message: 'Worker expense deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting worker expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting worker expense',
      error: error.message
    });
  }
});

// Update worker
router.put('/:id', async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }
    
    res.json({
      success: true,
      data: worker,
      message: 'Worker updated successfully'
    });
  } catch (error) {
    console.error('Error updating worker:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating worker',
      error: error.message
    });
  }
});

// Delete worker
router.delete('/:id', async (req, res) => {
  try {
    const worker = await Worker.findByIdAndDelete(req.params.id);
    
    if (!worker) {
      return res.status(404).json({
        success: false,
        message: 'Worker not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Worker deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting worker:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting worker',
      error: error.message
    });
  }
});

module.exports = router;