const mongoose = require('mongoose');

const workerSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },

  workerId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  address: {
    type: String,
    default: 'Not provided'
  },
  salary: {
    type: Number,
    required: true,
    default: 0
  },
  monthlySalary: {
    type: Number,
    default: 0
  },
  position: {
    type: String,
    default: 'Worker'
  },
  hireDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  villageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village'
  },
  assignedVillages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village'
  }],
  advancePayments: [{
    amount: {
      type: Number,
      required: true
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
  }],
  expenses: [{
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String,
      default: 'Expense'
    },
    category: {
      type: String,
      enum: ['transport', 'materials', 'food', 'accommodation', 'other'],
      default: 'other'
    },
    date: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Auto-set monthlySalary from salary if not provided
workerSchema.pre('save', function (next) {
  if (!this.monthlySalary && this.salary) {
    this.monthlySalary = this.salary;
  }
  next();
});

module.exports = mongoose.model('Worker', workerSchema);