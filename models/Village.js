const mongoose = require('mongoose');

const villageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  location: {
    type: String,
    required: true
  },
  monthlyFee: {
    type: Number,
    required: true,
    default: 0
  },
  totalCustomers: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  description: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Village', villageSchema);