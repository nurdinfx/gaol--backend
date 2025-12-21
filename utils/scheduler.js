const cron = require('node-cron');
const Customer = require('../models/Customer');

const checkAndResetMonthlyPayments = async () => {
    try {
        const now = new Date();
        // Format: YYYY-MM
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        console.log(`[Scheduler] Checking monthly payments for ${currentMonth}...`);

        // efficient batch processing
        const cursor = Customer.find({ status: 'active' }).cursor();

        let processedCount = 0;
        let errorCount = 0;

        for (let customer = await cursor.next(); customer != null; customer = await cursor.next()) {
            try {
                // Check if payment for this month already exists
                const exists = customer.monthlyPayments?.some(p => p.month === currentMonth);

                if (!exists) {
                    // Logic similar to initialization endpoint
                    const previousBalance = customer.getPreviousMonthBalance(currentMonth);
                    const totalDue = previousBalance + customer.monthlyFee;

                    // Convert payments to Map if needed for consistency internally, but we use object for legacy map
                    // Just ensure we update both structures

                    // 1. Add to monthlyPayments array
                    customer.monthlyPayments.push({
                        month: currentMonth,
                        date: now,
                        monthlyFee: customer.monthlyFee,
                        previousBalance: previousBalance,
                        paid: 0,
                        remaining: totalDue,
                        fullyPaid: false,
                        totalDue: totalDue
                    });

                    // 2. Update legacy payments Map/Object
                    // We need to handle this carefully as it might be a Map or Object in Mongoose depending on version/setup
                    // The model defines it as Map, but it might be hydrated as object.
                    // Safest is to treat it as we do in the route
                    let payments = {};
                    if (customer.payments instanceof Map) {
                        payments = Object.fromEntries(customer.payments);
                    } else if (customer.payments && typeof customer.payments === 'object') {
                        payments = { ...customer.payments };
                    }

                    payments[currentMonth] = {
                        paid: 0,
                        remaining: totalDue,
                        fullyPaid: false,
                        date: now,
                        previousBalance: previousBalance,
                        totalDue: totalDue
                    };

                    customer.payments = payments;

                    // Mark modified
                    customer.markModified('payments');
                    customer.markModified('monthlyPayments');

                    await customer.save();
                    processedCount++;
                }
            } catch (err) {
                console.error(`[Scheduler] Error processing customer ${customer._id}:`, err);
                errorCount++;
            }
        }

        if (processedCount > 0) {
            console.log(`[Scheduler] Successfully initialized ${processedCount} customers for ${currentMonth}. Errors: ${errorCount}`);
        } else {
            console.log(`[Scheduler] No new initializations needed for ${currentMonth}.`);
        }

    } catch (error) {
        console.error('[Scheduler] Critical error in checkAndResetMonthlyPayments:', error);
    }
};

// Initialize scheduler
const initScheduler = () => {
    console.log('✅ Scheduler initialized');

    // Run checking immediately on startup (for robustness)
    checkAndResetMonthlyPayments();

    // Schedule to run every day at 00:01
    cron.schedule('1 0 * * *', () => {
        console.log('cron job running');
        checkAndResetMonthlyPayments();
    });
};

module.exports = { initScheduler };
