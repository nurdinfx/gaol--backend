const express = require('express');
const Customer = require('../models/Customer');
const router = express.Router();

// Get all customers with village and zone information
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate('villageId', 'name code')
      .populate('zoneId', 'name code collectionDay villageId');
    res.json({ 
      success: true, 
      data: customers,
      message: 'Customers fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching customers',
      error: error.message 
    });
  }
});

// Get single customer
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('villageId', 'name code')
      .populate('zoneId', 'name code collectionDay villageId');
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching customer',
      error: error.message
    });
  }
});

// Create new customer
router.post('/', async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    await customer.populate('villageId', 'name code');
    await customer.populate('zoneId', 'name code collectionDay villageId');
    
    res.status(201).json({
      success: true,
      data: customer,
      message: 'Customer created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating customer',
      error: error.message
    });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
    .populate('villageId', 'name code')
    .populate('zoneId', 'name code collectionDay villageId');
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      data: customer,
      message: 'Customer updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating customer',
      error: error.message
    });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting customer',
      error: error.message
    });
  }
});

// Initialize or update monthly payment with date and carry-over calculation
router.post('/:id/monthly-payment', async (req, res) => {
  try {
    const { month, date } = req.body;
    const customer = await Customer.findById(req.params.id).lean(false);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get zoneId if it exists (optional field)
    const customerZoneId = customer.zoneId?._id || customer.zoneId || customer.get('zoneId');

    if (!month || !date) {
      return res.status(400).json({
        success: false,
        message: 'Month and date are required'
      });
    }

    // Calculate previous month's balance
    const previousBalance = customer.getPreviousMonthBalance(month);
    const totalDue = previousBalance + customer.monthlyFee;

    // Convert payments to plain object if it's a Map
    let payments = {};
    if (customer.payments instanceof Map) {
      payments = Object.fromEntries(customer.payments);
    } else if (customer.payments && typeof customer.payments === 'object') {
      payments = { ...customer.payments };
    }

    // Check if monthly payment already exists
    const existingMonthlyPaymentIndex = customer.monthlyPayments?.findIndex(
      p => p.month === month
    );

    const monthlyPaymentData = {
      month,
      date: new Date(date),
      monthlyFee: customer.monthlyFee,
      previousBalance,
      paid: payments[month]?.paid || 0,
      remaining: totalDue - (payments[month]?.paid || 0),
      fullyPaid: false,
      totalDue
    };

    if (existingMonthlyPaymentIndex !== -1) {
      // Update existing monthly payment (only update date if provided)
      customer.monthlyPayments[existingMonthlyPaymentIndex] = {
        ...customer.monthlyPayments[existingMonthlyPaymentIndex],
        date: new Date(date),
        previousBalance,
        totalDue,
        remaining: totalDue - (customer.monthlyPayments[existingMonthlyPaymentIndex].paid || 0)
      };
    } else {
      // Create new monthly payment
      customer.monthlyPayments = customer.monthlyPayments || [];
      customer.monthlyPayments.push(monthlyPaymentData);
    }

    // Update payments object for backward compatibility
    payments[month] = {
      paid: payments[month]?.paid || 0,
      remaining: totalDue - (payments[month]?.paid || 0),
      fullyPaid: (payments[month]?.paid || 0) >= totalDue,
      paidDate: payments[month]?.paidDate || null,
      date: new Date(date),
      previousBalance,
      totalDue
    };

    // Ensure all paymentHistory entries have dates before saving
    if (customer.paymentHistory && customer.paymentHistory.length > 0) {
      customer.paymentHistory.forEach((payment, index) => {
        // Use set() method to properly update subdocument
        if (!payment.date) {
          customer.paymentHistory[index].set('date', payment.paidDate || new Date());
        }
      });
    }

    // Store zoneId to ensure it's preserved - use the zoneId we checked earlier
    let zoneIdValue = customerZoneId;
    if (typeof customerZoneId === 'object' && customerZoneId !== null) {
      zoneIdValue = customerZoneId._id || customerZoneId;
    }

    customer.payments = payments;
    
    // Ensure zoneId is properly set as ObjectId before saving
    customer.zoneId = zoneIdValue;
    
    // Mark as modified
    customer.markModified('payments');
    if (customer.monthlyPayments && customer.monthlyPayments.length > 0) {
      customer.markModified('monthlyPayments');
    }
    if (customer.paymentHistory && customer.paymentHistory.length > 0) {
      customer.markModified('paymentHistory');
    }
    
    // Save with validation - pre-save hook will ensure dates are set
    const updatedCustomer = await customer.save();
    await updatedCustomer.populate('villageId', 'name code');
    await updatedCustomer.populate('zoneId', 'name code collectionDay villageId');

    res.json({
      success: true,
      data: updatedCustomer,
      message: 'Monthly payment initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing monthly payment:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
    // Provide more detailed error message
    let errorMessage = error.message;
    if (error.name === 'ValidationError' && error.errors) {
      const validationErrors = Object.values(error.errors).map(err => err.message).join(', ');
      errorMessage = `Validation error: ${validationErrors}`;
    }
    
    res.status(400).json({
      success: false,
      message: 'Error initializing monthly payment',
      error: errorMessage,
      details: error.errors || {}
    });
  }
});

// Update customer payment status with carry-over calculation
router.patch('/:id/payment', async (req, res) => {
  try {
    const { month, paid, paidDate, method } = req.body;
    const customer = await Customer.findById(req.params.id).lean(false);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get zoneId if it exists (optional field)
    const customerZoneId = customer.zoneId?._id || customer.zoneId || customer.get('zoneId');

    // Calculate previous month's balance and total due
    const previousBalance = customer.getPreviousMonthBalance(month);
    const totalDue = previousBalance + customer.monthlyFee;

    // Convert payments to plain object if it's a Map
    let payments = {};
    if (customer.payments instanceof Map) {
      payments = Object.fromEntries(customer.payments);
    } else if (customer.payments && typeof customer.payments === 'object') {
      payments = { ...customer.payments };
    }

    // Get current payment for the month
    const currentPaid = payments[month]?.paid || 0;
    const paymentAmount = typeof paid === 'number' ? paid : (paid ? totalDue : 0);
    const newPaid = paymentAmount;
    const newRemaining = Math.max(0, totalDue - newPaid);
    const fullyPaid = newRemaining <= 0;

    // Update monthly payment
    const monthlyPaymentIndex = customer.monthlyPayments?.findIndex(
      p => p.month === month
    );

    if (monthlyPaymentIndex !== -1) {
      customer.monthlyPayments[monthlyPaymentIndex].paid = newPaid;
      customer.monthlyPayments[monthlyPaymentIndex].remaining = newRemaining;
      customer.monthlyPayments[monthlyPaymentIndex].fullyPaid = fullyPaid;
      if (paidDate) {
        customer.monthlyPayments[monthlyPaymentIndex].paidDate = new Date(paidDate);
      }
    } else {
      // Create monthly payment if it doesn't exist
      customer.monthlyPayments = customer.monthlyPayments || [];
      customer.monthlyPayments.push({
        month,
        date: new Date(),
        monthlyFee: customer.monthlyFee,
        previousBalance,
        paid: newPaid,
        remaining: newRemaining,
        fullyPaid,
        paidDate: paidDate ? new Date(paidDate) : null,
        totalDue
      });
    }

    // Update payment history
    const existingPaymentIndex = customer.paymentHistory.findIndex(
      payment => payment.month === month
    );

    if (existingPaymentIndex !== -1) {
      customer.paymentHistory[existingPaymentIndex].paid = newPaid;
      customer.paymentHistory[existingPaymentIndex].paidDate = paidDate ? new Date(paidDate) : null;
      if (method) customer.paymentHistory[existingPaymentIndex].method = method;
      // Ensure date exists
      if (!customer.paymentHistory[existingPaymentIndex].date) {
        customer.paymentHistory[existingPaymentIndex].date = customer.paymentHistory[existingPaymentIndex].paidDate || new Date();
      }
    } else {
      customer.paymentHistory.push({
        month,
        amount: totalDue,
        paid: newPaid,
        paidDate: paidDate ? new Date(paidDate) : null,
        method: method || 'cash',
        date: new Date()
      });
    }

    // Ensure all paymentHistory entries have dates before saving
    if (customer.paymentHistory && customer.paymentHistory.length > 0) {
      customer.paymentHistory.forEach((payment, index) => {
        if (!payment.date) {
          customer.paymentHistory[index].date = payment.paidDate || new Date();
        }
      });
    }

    // Store zoneId to ensure it's preserved - use the zoneId we checked earlier
    let zoneIdValue = customerZoneId;
    if (typeof customerZoneId === 'object' && customerZoneId !== null) {
      zoneIdValue = customerZoneId._id || customerZoneId;
    }

    // Update payments object for backward compatibility
    payments[month] = {
      paid: newPaid,
      remaining: newRemaining,
      fullyPaid,
      paidDate: paidDate ? new Date(paidDate) : null,
      date: payments[month]?.date || new Date(),
      previousBalance,
      totalDue
    };

    customer.payments = payments;
    
    // Ensure zoneId is properly set as ObjectId before saving
    customer.zoneId = zoneIdValue;
    
    // Mark as modified to ensure Mongoose saves changes
    if (customer.paymentHistory && customer.paymentHistory.length > 0) {
      customer.markModified('paymentHistory');
    }
    customer.markModified('payments');
    if (customer.monthlyPayments && customer.monthlyPayments.length > 0) {
      customer.markModified('monthlyPayments');
    }
    
    await customer.save();
    await customer.populate('villageId', 'name code');
    await customer.populate('zoneId', 'name code collectionDay villageId');

    res.json({
      success: true,
      data: customer,
      message: `Payment updated successfully`
    });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(400).json({
      success: false,
      message: 'Error updating payment status',
      error: error.message
    });
  }
});

// Add partial payment to a month
router.post('/:id/partial-payment', async (req, res) => {
  try {
    const { month, amount, paidDate, method } = req.body;
    const customer = await Customer.findById(req.params.id).lean(false);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get zoneId if it exists (optional field)
    const customerZoneId = customer.zoneId?._id || customer.zoneId || customer.get('zoneId');

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid payment amount is required'
      });
    }

    // Calculate previous month's balance and total due
    const previousBalance = customer.getPreviousMonthBalance(month);
    const totalDue = previousBalance + customer.monthlyFee;

    // Convert payments to plain object if it's a Map
    let payments = {};
    if (customer.payments instanceof Map) {
      payments = Object.fromEntries(customer.payments);
    } else if (customer.payments && typeof customer.payments === 'object') {
      payments = { ...customer.payments };
    }

    const currentPaid = payments[month]?.paid || 0;
    const newPaid = currentPaid + amount;
    const newRemaining = Math.max(0, totalDue - newPaid);
    const fullyPaid = newRemaining <= 0;

    // Update monthly payment
    const monthlyPaymentIndex = customer.monthlyPayments?.findIndex(
      p => p.month === month
    );

    if (monthlyPaymentIndex !== -1) {
      customer.monthlyPayments[monthlyPaymentIndex].paid = newPaid;
      customer.monthlyPayments[monthlyPaymentIndex].remaining = newRemaining;
      customer.monthlyPayments[monthlyPaymentIndex].fullyPaid = fullyPaid;
      if (paidDate) {
        customer.monthlyPayments[monthlyPaymentIndex].paidDate = new Date(paidDate);
      }
    } else {
      // Create monthly payment if it doesn't exist
      customer.monthlyPayments = customer.monthlyPayments || [];
      customer.monthlyPayments.push({
        month,
        date: new Date(),
        monthlyFee: customer.monthlyFee,
        previousBalance,
        paid: newPaid,
        remaining: newRemaining,
        fullyPaid,
        paidDate: paidDate ? new Date(paidDate) : null,
        totalDue
      });
    }

    // Update payment history
    const existingPaymentIndex = customer.paymentHistory.findIndex(
      payment => payment.month === month
    );

    if (existingPaymentIndex !== -1) {
      customer.paymentHistory[existingPaymentIndex].paid = newPaid;
      customer.paymentHistory[existingPaymentIndex].paidDate = paidDate ? new Date(paidDate) : null;
      if (method) customer.paymentHistory[existingPaymentIndex].method = method;
      // Ensure date exists
      if (!customer.paymentHistory[existingPaymentIndex].date) {
        customer.paymentHistory[existingPaymentIndex].date = customer.paymentHistory[existingPaymentIndex].paidDate || new Date();
      }
    } else {
      customer.paymentHistory.push({
        month,
        amount: totalDue,
        paid: newPaid,
        paidDate: paidDate ? new Date(paidDate) : null,
        method: method || 'cash',
        date: new Date()
      });
    }

    // Ensure all paymentHistory entries have dates before saving
    if (customer.paymentHistory && customer.paymentHistory.length > 0) {
      customer.paymentHistory.forEach((payment, index) => {
        if (!payment.date) {
          customer.paymentHistory[index].date = payment.paidDate || new Date();
        }
      });
    }

    // Update payments object
    payments[month] = {
      paid: newPaid,
      remaining: newRemaining,
      fullyPaid,
      paidDate: paidDate ? new Date(paidDate) : null,
      date: payments[month]?.date || new Date(),
      previousBalance,
      totalDue
    };

    // Store zoneId to ensure it's preserved if it exists
    if (customerZoneId) {
      let zoneIdValue = customerZoneId;
      if (typeof customerZoneId === 'object' && customerZoneId !== null) {
        zoneIdValue = customerZoneId._id || customerZoneId;
      }
      customer.zoneId = zoneIdValue;
    }
    
    customer.payments = payments;
    
    // Mark as modified to ensure Mongoose saves changes
    if (customer.paymentHistory && customer.paymentHistory.length > 0) {
      customer.markModified('paymentHistory');
    }
    customer.markModified('payments');
    if (customer.monthlyPayments && customer.monthlyPayments.length > 0) {
      customer.markModified('monthlyPayments');
    }
    
    await customer.save();
    await customer.populate('villageId', 'name code');
    await customer.populate('zoneId', 'name code collectionDay villageId');

    res.json({
      success: true,
      data: customer,
      message: `Partial payment of $${amount} processed successfully`
    });
  } catch (error) {
    console.error('Error processing partial payment:', error);
    res.status(400).json({
      success: false,
      message: 'Error processing partial payment',
      error: error.message
    });
  }
});

// Mark all customers as paid for a specific month
router.patch('/payments/mark-all-paid', async (req, res) => {
  try {
    const { month } = req.body;
    
    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month is required'
      });
    }

    const currentDate = new Date();
    const customers = await Customer.find({});
    let updatedCount = 0;

    for (const customer of customers) {
      try {
        // Get zoneId if it exists (optional field)
        const customerZoneId = customer.zoneId?._id || customer.zoneId || customer.get('zoneId');

        // Calculate previous month's balance and total due
        const previousBalance = customer.getPreviousMonthBalance(month);
        const totalDue = previousBalance + customer.monthlyFee;

        // Convert payments to plain object if it's a Map
        let payments = {};
        if (customer.payments instanceof Map) {
          payments = Object.fromEntries(customer.payments);
        } else if (customer.payments && typeof customer.payments === 'object') {
          payments = { ...customer.payments };
        }

        // Update payments for the specific month
        payments[month] = {
          paid: totalDue,
          remaining: 0,
          fullyPaid: true,
          paidDate: currentDate,
          date: payments[month]?.date || currentDate,
          previousBalance,
          totalDue
        };

        // Update monthlyPayments
        const monthlyPaymentIndex = customer.monthlyPayments?.findIndex(
          p => p.month === month
        );

        if (monthlyPaymentIndex !== -1) {
          customer.monthlyPayments[monthlyPaymentIndex].paid = totalDue;
          customer.monthlyPayments[monthlyPaymentIndex].remaining = 0;
          customer.monthlyPayments[monthlyPaymentIndex].fullyPaid = true;
          customer.monthlyPayments[monthlyPaymentIndex].paidDate = currentDate;
        } else {
          customer.monthlyPayments = customer.monthlyPayments || [];
          customer.monthlyPayments.push({
            month,
            date: payments[month]?.date || currentDate,
            monthlyFee: customer.monthlyFee,
            previousBalance,
            paid: totalDue,
            remaining: 0,
            fullyPaid: true,
            paidDate: currentDate,
            totalDue
          });
        }

        // Update paymentHistory
        const paymentHistory = customer.paymentHistory ? [...customer.paymentHistory] : [];
        const existingPaymentIndex = paymentHistory.findIndex(
          payment => payment.month === month
        );

        if (existingPaymentIndex !== -1) {
          paymentHistory[existingPaymentIndex] = {
            month: month,
            amount: totalDue,
            paid: totalDue,
            paidDate: currentDate,
            method: paymentHistory[existingPaymentIndex].method || 'cash',
            date: paymentHistory[existingPaymentIndex].date || currentDate
          };
        } else {
          paymentHistory.push({
            month: month,
            amount: totalDue,
            paid: totalDue,
            paidDate: currentDate,
            method: 'cash',
            date: currentDate
          });
        }

        // Ensure all paymentHistory entries have dates
        paymentHistory.forEach(payment => {
          if (!payment.date) {
            payment.date = payment.paidDate || currentDate;
          }
        });

        // Update the customer - ensure all paymentHistory entries have dates
        const updatedPaymentHistory = paymentHistory.map(payment => {
          if (!payment.date) {
            payment.date = payment.paidDate || currentDate;
          }
          return payment;
        });

        // Prepare update object - preserve zoneId if it exists
        const updateData = {
          payments: payments,
          monthlyPayments: customer.monthlyPayments,
          paymentHistory: updatedPaymentHistory
        };
        
        // Preserve zoneId if it exists
        if (customerZoneId) {
          let zoneIdValue = customerZoneId;
          if (typeof customerZoneId === 'object' && customerZoneId !== null) {
            zoneIdValue = customerZoneId._id || customerZoneId;
          }
          updateData.zoneId = zoneIdValue;
        }

        await Customer.findByIdAndUpdate(
          customer._id,
          updateData,
          { new: true, runValidators: true }
        );

        updatedCount++;
      } catch (customerError) {
        console.error(`Error updating customer ${customer._id}:`, customerError);
      }
    }

    res.json({
      success: true,
      data: {
        totalCustomers: customers.length,
        updatedCount: updatedCount
      },
      message: `Successfully marked ${updatedCount} out of ${customers.length} customers as paid for ${month}`
    });
  } catch (error) {
    console.error('Error in mark-all-paid:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all customers as paid',
      error: error.message
    });
  }
});

// Get customer stats
router.get('/stats/summary', async (req, res) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const activeCustomers = await Customer.countDocuments({ status: 'active' });
    
    res.json({
      success: true,
      data: {
        totalCustomers,
        activeCustomers,
        pendingPayments: 0
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching customer stats',
      error: error.message 
    });
  }
});

module.exports = router;
