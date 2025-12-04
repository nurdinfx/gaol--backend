const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  supervisor: {
    type: String,
    default: ''
  },
  contactNumber: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  zoneNumber: {
    type: Number,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Add index for better query performance
zoneSchema.index({ zoneNumber: 1 });
zoneSchema.index({ code: 1 });

module.exports = mongoose.model('Zone', zoneSchema);