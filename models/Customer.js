// models/Customer.js
const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  month: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paid: {
    type: Number,
    default: 0
  },
  paidDate: Date,
  method: {
    type: String,
    enum: ['cash', 'bank_transfer', 'card'],
    default: 'cash'
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const monthlyPaymentSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  monthlyFee: {
    type: Number,
    required: true
  },
  previousBalance: {
    type: Number,
    default: 0
  },
  paid: {
    type: Number,
    default: 0
  },
  remaining: {
    type: Number,
    required: true
  },
  fullyPaid: {
    type: Boolean,
    default: false
  },
  paidDate: Date,
  totalDue: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

const customerSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  address: {
    type: String,
    required: true
  },
  villageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village'
  },
  zoneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    required: false
  },
  monthlyFee: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  paymentHistory: [paymentHistorySchema],
  monthlyPayments: [monthlyPaymentSchema],
  // Keep old payments structure for backward compatibility
  payments: {
    type: Map,
    of: new mongoose.Schema({
      paid: {
        type: Number,
        default: 0
      },
      remaining: {
        type: Number,
        default: function() {
          return this.parent().monthlyFee;
        }
      },
      fullyPaid: {
        type: Boolean,
        default: false
      },
      paidDate: {
        type: Date,
        default: null
      },
      date: {
        type: Date,
        default: null
      },
      previousBalance: {
        type: Number,
        default: 0
      },
      totalDue: {
        type: Number,
        default: function() {
          return this.parent().monthlyFee;
        }
      }
    }),
    default: {}
  }
}, {
  timestamps: true
});

// Add pre-save middleware to automatically set villageId from zone and ensure paymentHistory dates
customerSchema.pre('save', async function(next) {
  try {
    // Ensure zoneId is preserved - convert to ObjectId if it's an object
    if (this.zoneId) {
      if (typeof this.zoneId === 'object' && this.zoneId._id) {
        this.zoneId = this.zoneId._id;
      } else if (typeof this.zoneId === 'object' && !mongoose.Types.ObjectId.isValid(this.zoneId)) {
        // If it's an object but not a valid ObjectId, try to get the _id
        this.zoneId = this.zoneId.toString();
      }
      // Ensure it's a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(this.zoneId)) {
        return next(new Error('Invalid zoneId'));
      }
    }
    // zoneId is optional, so we don't fail if it's missing

    // If zoneId is provided but villageId is not, populate villageId from zone
    if (this.zoneId && !this.villageId && mongoose.Types.ObjectId.isValid(this.zoneId)) {
      const Zone = mongoose.model('Zone');
      const zone = await Zone.findById(this.zoneId);
      if (zone) {
        this.villageId = zone.villageId;
      }
    }
    
    // Convert payments object to Map if it's a plain object
    if (this.payments && typeof this.payments === 'object' && !(this.payments instanceof Map)) {
      this.payments = new Map(Object.entries(this.payments));
    }

    // Ensure all paymentHistory entries have dates
    if (this.paymentHistory && this.paymentHistory.length > 0) {
      this.paymentHistory.forEach((payment, index) => {
        if (!payment.date) {
          this.paymentHistory[index].date = payment.paidDate || new Date();
        }
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Convert Map to Object when converting to JSON
customerSchema.methods.toJSON = function() {
  const customer = this.toObject();
  if (customer.payments instanceof Map) {
    customer.payments = Object.fromEntries(customer.payments);
  }
  return customer;
};

// Helper method to get previous month's remaining balance
customerSchema.methods.getPreviousMonthBalance = function(month) {
  const [year, monthNum] = month.split('-').map(Number);
  let prevYear = year;
  let prevMonth = monthNum - 1;
  
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear = year - 1;
  }
  
  const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  
  // Check monthlyPayments first
  const prevMonthlyPayment = this.monthlyPayments?.find(p => p.month === prevMonthStr);
  if (prevMonthlyPayment) {
    // If previous month was fully paid, remaining balance is 0
    if (prevMonthlyPayment.fullyPaid) {
      return 0;
    }
    return prevMonthlyPayment.remaining || 0;
  }
  
  // Fallback to old payments structure
  const prevPayment = this.payments?.get?.(prevMonthStr) || this.payments?.[prevMonthStr];
  if (prevPayment) {
    // If previous month was fully paid, remaining balance is 0
    if (prevPayment.fullyPaid) {
      return 0;
    }
    return prevPayment.remaining || 0;
  }
  
  return 0;
};

// Helper method to calculate total due for a month (previous balance + monthly fee)
customerSchema.methods.calculateTotalDue = function(month) {
  const previousBalance = this.getPreviousMonthBalance(month);
  return previousBalance + this.monthlyFee;
};

module.exports = mongoose.model('Customer', customerSchema);
