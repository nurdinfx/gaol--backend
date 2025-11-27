const express = require('express');
const router = express.Router();

// Temporary in-memory storage (replace with MongoDB in production)
let companyExpenses = [];
let expenseIdCounter = 1;

// Get all company expenses
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: companyExpenses,
      message: 'Company expenses fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching company expenses',
      error: error.message
    });
  }
});

// Create new company expense
router.post('/', async (req, res) => {
  try {
    const expenseData = {
      _id: `expense_${expenseIdCounter++}`,
      description: req.body.description,
      amount: parseFloat(req.body.amount),
      category: req.body.category,
      receiptNumber: req.body.receiptNumber || '',
      paidTo: req.body.paidTo || '',
      notes: req.body.notes || '',
      date: req.body.date || new Date().toISOString().split('T')[0],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate required fields
    if (!expenseData.description || !expenseData.amount) {
      return res.status(400).json({
        success: false,
        message: 'Description and amount are required fields'
      });
    }

    if (expenseData.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    companyExpenses.push(expenseData);
    
    res.status(201).json({
      success: true,
      data: expenseData,
      message: 'Company expense created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating company expense',
      error: error.message
    });
  }
});

// Update company expense - FIXED VERSION
router.put('/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expenseIndex = companyExpenses.findIndex(exp => exp._id === expenseId);
    
    if (expenseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Company expense not found'
      });
    }

    const existingExpense = companyExpenses[expenseIndex];
    
    // Only update fields that are provided in the request, preserve others
    const updatedExpense = {
      ...existingExpense,
      description: req.body.description !== undefined ? req.body.description : existingExpense.description,
      amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : existingExpense.amount,
      category: req.body.category !== undefined ? req.body.category : existingExpense.category,
      receiptNumber: req.body.receiptNumber !== undefined ? req.body.receiptNumber : existingExpense.receiptNumber,
      paidTo: req.body.paidTo !== undefined ? req.body.paidTo : existingExpense.paidTo,
      notes: req.body.notes !== undefined ? req.body.notes : existingExpense.notes,
      date: req.body.date !== undefined ? req.body.date : existingExpense.date, // Preserve date if not provided
      updatedAt: new Date()
    };

    companyExpenses[expenseIndex] = updatedExpense;

    res.json({
      success: true,
      data: updatedExpense,
      message: 'Company expense updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating company expense',
      error: error.message
    });
  }
});

// Delete company expense
router.delete('/:id', async (req, res) => {
  try {
    const expenseId = req.params.id;
    const expenseIndex = companyExpenses.findIndex(exp => exp._id === expenseId);
    
    if (expenseIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Company expense not found'
      });
    }

    companyExpenses.splice(expenseIndex, 1);

    res.json({
      success: true,
      message: 'Company expense deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting company expense',
      error: error.message
    });
  }
});

// Get expense summary
router.get('/summary', async (req, res) => {
  try {
    const totalExpenses = companyExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    res.json({
      success: true,
      data: {
        totalExpenses,
        totalRecords: companyExpenses.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching expense summary',
      error: error.message
    });
  }
});

module.exports = router;