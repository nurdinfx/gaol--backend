const mongoose = require('mongoose');

const companyExpenseSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Expense type is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0']
  },
  category: {
    type: String,
    trim: true,
    default: 'general'
  },
  employeeName: {
    type: String,
    trim: true,
    default: ''
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  date: {
    type: Date,
    required: [true, 'Expense date is required'],
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CompanyExpense', companyExpenseSchema);
