const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  withdrawDate: {
    type: Date,
    default: Date.now
  },
  referenceNumber: {
    type: String,
    unique: true
  },
  bankDetails: {
    bankName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountHolder: String,
    branch: String
  },
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate reference number before saving
withdrawSchema.pre('save', async function(next) {
  if (!this.referenceNumber) {
    const count = await mongoose.model('Withdraw').countDocuments();
    this.referenceNumber = `WD${Date.now().toString().slice(-6)}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Withdraw', withdrawSchema);
