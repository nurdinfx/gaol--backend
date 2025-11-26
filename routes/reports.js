const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Zone = require('../models/Zone');
const Village = require('../models/Village');

// Helper: compute payment metrics for a customer for a given month
function getCustomerMonthPayment(customer, month) {
  const monthlyFee = Number(customer.monthlyFee) || 0;
  const previousBalance = typeof customer.getPreviousMonthBalance === 'function'
    ? customer.getPreviousMonthBalance(month)
    : 0;
  const totalDue = previousBalance + monthlyFee;

  let paid = 0;
  let fullyPaid = false;
  let paidDate = null;
  let date = null;

  const mp = Array.isArray(customer.monthlyPayments)
    ? customer.monthlyPayments.find(p => p.month === month)
    : null;
  if (mp) {
    paid = Number(mp.paid) || 0;
    fullyPaid = mp.fullyPaid === true || (paid >= totalDue);
    paidDate = mp.paidDate || null;
    date = mp.date || null;
  } else if (customer.payments && customer.payments[month]) {
    const p = customer.payments[month];
    paid = Number(p.paid) || 0;
    fullyPaid = p.fullyPaid === true || (paid >= totalDue);
    paidDate = p.paidDate || null;
    date = p.date || null;
  }

  const remaining = Math.max(0, totalDue - paid);

  return { monthlyFee, previousBalance, totalDue, paid, remaining, fullyPaid, paidDate, date };
}

// Helper: most common date across customers for the month
function getMonthRealDate(customers, month) {
  const dates = [];
  for (const c of customers) {
    const mp = Array.isArray(c.monthlyPayments) ? c.monthlyPayments.find(p => p.month === month && p.date) : null;
    if (mp && mp.date) dates.push(mp.date);
    const legacy = c.payments && c.payments[month];
    if (legacy && legacy.date) dates.push(legacy.date);
  }
  if (dates.length === 0) return null;
  const freq = dates.reduce((acc, d) => { const k = new Date(d).toISOString(); acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const commonIso = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  return new Date(commonIso);
}

// Village breakdown grouped by zone
router.get('/village-breakdown', async (req, res) => {
  try {
    const month = req.query.month;
    if (!month || !/^[0-9]{4}-[0-9]{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Valid month (YYYY-MM) is required' });
    }

    const [zones, villages, customers] = await Promise.all([
      Zone.find().sort({ zoneNumber: 1 }).lean(),
      Village.find().lean(),
      Customer.find().lean(false),
    ]);

    const villageById = new Map(villages.map(v => [String(v._id), v]));

    const overall = {
      totalZones: zones.length,
      totalCustomers: 0,
      totalRevenue: 0,
      totalPaid: 0,
      totalUnpaidAmount: 0,
      totalNetProfit: 0,
      totalPaidCustomers: 0,
      totalUnpaidCustomers: 0,
      totalPartialPayments: 0,
    };

    const zonesData = zones.map(zone => {
      const zoneCustomers = customers.filter(c => String(c.zoneId) === String(zone._id) || (c.zoneId && c.zoneId._id && String(c.zoneId._id) === String(zone._id)));

      const villageIds = Array.from(new Set(zoneCustomers.map(c => {
        const v = c.villageId;
        return typeof v === 'object' && v?._id ? String(v._id) : String(v);
      }).filter(Boolean)));

      const villagesData = villageIds.map(vId => {
        const vCustomers = zoneCustomers.filter(c => {
          const vid = typeof c.villageId === 'object' && c.villageId?._id ? String(c.villageId._id) : String(c.villageId);
          return vid === vId;
        });

        const stats = vCustomers.reduce((acc, c) => {
          const p = getCustomerMonthPayment(c, month);
          acc.totalCustomers += 1;
          acc.totalDue += p.totalDue;
          acc.totalPaid += p.paid;
          acc.totalRemaining += p.remaining;
          acc.paidCustomers += p.fullyPaid ? 1 : 0;
          acc.unpaidCustomers += p.paid === 0 ? 1 : 0;
          acc.partialCustomers += (p.paid > 0 && !p.fullyPaid) ? 1 : 0;
          return acc;
        }, { totalCustomers: 0, totalDue: 0, totalPaid: 0, totalRemaining: 0, paidCustomers: 0, unpaidCustomers: 0, partialCustomers: 0 });

        return {
          villageId: vId,
          villageName: villageById.get(vId)?.name || 'Unknown',
          villageCode: villageById.get(vId)?.code || '',
          collected: stats.totalPaid,
          due: stats.totalDue,
          unpaid: stats.totalRemaining,
          totalCustomers: stats.totalCustomers,
          paidCustomers: stats.paidCustomers,
          unpaidCustomers: stats.unpaidCustomers,
          partialCustomers: stats.partialCustomers,
          collectionRate: stats.totalDue > 0 ? (stats.totalPaid / stats.totalDue) * 100 : 0,
        };
      });

      const zoneTotals = villagesData.reduce((acc, v) => {
        acc.totalCustomers += v.totalCustomers;
        acc.totalRevenue += v.due;
        acc.totalPaid += v.collected;
        acc.totalUnpaidAmount += v.unpaid;
        acc.totalPaidCustomers += v.paidCustomers;
        acc.totalUnpaidCustomers += v.unpaidCustomers;
        acc.totalPartialPayments += v.partialCustomers;
        return acc;
      }, { totalCustomers: 0, totalRevenue: 0, totalPaid: 0, totalUnpaidAmount: 0, totalPaidCustomers: 0, totalUnpaidCustomers: 0, totalPartialPayments: 0 });

      overall.totalCustomers += zoneTotals.totalCustomers;
      overall.totalRevenue += zoneTotals.totalRevenue;
      overall.totalPaid += zoneTotals.totalPaid;
      overall.totalUnpaidAmount += zoneTotals.totalUnpaidAmount;
      overall.totalPaidCustomers += zoneTotals.totalPaidCustomers;
      overall.totalUnpaidCustomers += zoneTotals.totalUnpaidCustomers;
      overall.totalPartialPayments += zoneTotals.totalPartialPayments;

      return {
        _id: zone._id,
        name: zone.name,
        zoneNumber: zone.zoneNumber,
        monthDate: getMonthRealDate(zoneCustomers, month),
        villages: villagesData,
        stats: {
          ...zoneTotals,
          netProfit: zoneTotals.totalPaid,
          collectionRate: zoneTotals.totalRevenue > 0 ? (zoneTotals.totalPaid / zoneTotals.totalRevenue) * 100 : 0,
        }
      };
    });

    const monthDateOverall = getMonthRealDate(customers, month);

    res.json({
      success: true,
      data: {
        month,
        monthDate: monthDateOverall,
        zones: zonesData,
        overall: {
          ...overall,
          netProfit: overall.totalPaid,
          collectionRate: overall.totalRevenue > 0 ? (overall.totalPaid / overall.totalRevenue) * 100 : 0,
        }
      }
    });
  } catch (error) {
    console.error('Error generating village breakdown report:', error);
    res.status(500).json({ success: false, message: 'Error generating report', error: error.message });
  }
});

module.exports = router;
