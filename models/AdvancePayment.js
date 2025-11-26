const mongoose = require('mongoose');

const advancePaymentSchema = new mongoose.Schema({
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Worker',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: 'Advance payment'
  },
  date: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: ['advance', 'expense'],
    default: 'advance'
  },
  category: {
    type: String,
    default: 'general'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add index for better query performance
advancePaymentSchema.index({ workerId: 1, date: 1 });

module.exports = mongoose.model('AdvancePayment', advancePaymentSchema);