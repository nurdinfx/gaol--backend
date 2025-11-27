const mongoose = require('mongoose');

const villageCollectionSchema = new mongoose.Schema({
  villageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village',
    required: false
  },
  villageName: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  householdsCollected: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  amountCollected: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Ensure one record per village per day
villageCollectionSchema.index({ villageId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('VillageCollection', villageCollectionSchema);
