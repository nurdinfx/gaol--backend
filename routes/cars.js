const express = require('express');
const Car = require('../models/Car');
const router = express.Router();

// Get all cars (only active ones)
router.get('/', async (req, res) => {
  try {
    const cars = await Car.find({ isActive: true }).sort({ createdAt: -1 });
    res.json({ 
      success: true, 
      data: cars,
      message: 'Cars fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching cars',
      error: error.message 
    });
  }
});

// Get single car (even if inactive)
router.get('/:id', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }
    res.json({
      success: true,
      data: car
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching car',
      error: error.message
    });
  }
});

// Create new car
router.post('/', async (req, res) => {
  try {
    const carData = {
      plateNumber: req.body.plateNumber?.toUpperCase().trim(),
      carType: req.body.carType?.trim(),
      status: req.body.status || 'active',
      isActive: true
    };

    // Check if plate number already exists (only active cars)
    const existingCar = await Car.findOne({ 
      plateNumber: carData.plateNumber,
      isActive: true 
    });
    
    if (existingCar) {
      return res.status(400).json({
        success: false,
        message: 'Car with this plate number already exists'
      });
    }

    const car = new Car(carData);
    await car.save();
    
    res.status(201).json({
      success: true,
      data: car,
      message: 'Car created successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating car',
      error: error.message
    });
  }
});

// Update car
router.put('/:id', async (req, res) => {
  try {
    const carData = { 
      plateNumber: req.body.plateNumber?.toUpperCase().trim(),
      carType: req.body.carType?.trim(),
      status: req.body.status,
      updatedAt: new Date()
    };
    
    // If plate number is being updated, check for duplicates
    if (carData.plateNumber) {
      const existingCar = await Car.findOne({ 
        plateNumber: carData.plateNumber,
        _id: { $ne: req.params.id },
        isActive: true 
      });
      
      if (existingCar) {
        return res.status(400).json({
          success: false,
          message: 'Another car with this plate number already exists'
        });
      }
    }

    const car = await Car.findByIdAndUpdate(
      req.params.id,
      carData,
      { new: true, runValidators: true }
    );
    
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }
    
    res.json({
      success: true,
      data: car,
      message: 'Car updated successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating car',
      error: error.message
    });
  }
});

// Delete car (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (!car) {
      return res.status(404).json({
        success: false,
        message: 'Car not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Car deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting car',
      error: error.message
    });
  }
});

// Add expense to car
router.post('/:id/expenses', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car || !car.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Car not found or inactive'
      });
    }

    const expenseData = {
      amount: parseFloat(req.body.amount),
      type: req.body.type,
      description: req.body.description,
      expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : new Date()
    };

    // Validate required fields
    if (!expenseData.amount || expenseData.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount is required and must be greater than 0'
      });
    }

    if (!expenseData.type || !expenseData.type.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Expense type is required'
      });
    }

    if (!expenseData.description || !expenseData.description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    // Validate expense type
    const validTypes = ['maintenance', 'fuel', 'repair', 'insurance', 'other'];
    if (!validTypes.includes(expenseData.type)) {
      return res.status(400).json({
        success: false,
        message: `Expense type must be one of: ${validTypes.join(', ')}`
      });
    }

    car.expenses.push(expenseData);
    await car.save();

    res.status(201).json({
      success: true,
      data: car,
      message: 'Expense added successfully'
    });
  } catch (error) {
    console.error('Error adding expense:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error adding expense',
      error: error.message
    });
  }
});

// Update expense
router.put('/:carId/expenses/:expenseId', async (req, res) => {
  try {
    const car = await Car.findById(req.params.carId);
    if (!car || !car.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Car not found or inactive'
      });
    }

    const expense = car.expenses.id(req.params.expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    const expenseData = {
      amount: req.body.amount !== undefined ? parseFloat(req.body.amount) : expense.amount,
      type: req.body.type || expense.type,
      description: req.body.description || expense.description,
      expenseDate: req.body.expenseDate ? new Date(req.body.expenseDate) : expense.expenseDate
    };

    // Validate required fields
    if (expenseData.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!expenseData.type.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Expense type is required'
      });
    }

    if (!expenseData.description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Description is required'
      });
    }

    // Validate expense type
    const validTypes = ['maintenance', 'fuel', 'repair', 'insurance', 'other'];
    if (!validTypes.includes(expenseData.type)) {
      return res.status(400).json({
        success: false,
        message: `Expense type must be one of: ${validTypes.join(', ')}`
      });
    }

    // Update expense fields
    expense.set(expenseData);
    await car.save();

    res.json({
      success: true,
      data: car,
      message: 'Expense updated successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating expense',
      error: error.message
    });
  }
});

// Delete expense
router.delete('/:carId/expenses/:expenseId', async (req, res) => {
  try {
    const car = await Car.findById(req.params.carId);
    if (!car || !car.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Car not found or inactive'
      });
    }

    const expense = car.expenses.id(req.params.expenseId);
    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found'
      });
    }

    expense.remove();
    await car.save();

    res.json({
      success: true,
      data: car,
      message: 'Expense deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting expense',
      error: error.message
    });
  }
});

module.exports = router;