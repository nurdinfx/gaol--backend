const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  expenseDate: {
    type: Date,
    required: [true, 'Expense date is required'],
    default: Date.now
  },
  type: {
    type: String,
    required: [true, 'Expense type is required'],
    enum: {
      values: ['maintenance', 'fuel', 'repair', 'insurance', 'other'],
      message: 'Expense type must be one of: maintenance, fuel, repair, insurance, other'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  }
}, {
  timestamps: true
});

const carSchema = new mongoose.Schema({
  plateNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  carType: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'inactive'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expenses: [expenseSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Car', carSchema);