const express = require('express');
const mongoose = require('mongoose');
const VillageCollection = require('../models/VillageCollection');
const Customer = require('../models/Customer');

const router = express.Router();

// Helper: normalize date to start of day
const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

// GET / - list collections (optional filters: villageId, villageName, date)
router.get('/', async (req, res) => {
  try {
    const { villageId, villageName, date } = req.query;
    const filter = {};
    if (villageId && mongoose.Types.ObjectId.isValid(villageId)) {
      filter.villageId = villageId;
    }
    if (villageName && typeof villageName === 'string') {
      filter.villageName = { $regex: new RegExp(`^${villageName}$`, 'i') };
    }
    if (date) {
      const s = startOfDay(date);
      const e = endOfDay(date);
      filter.date = { $gte: s, $lte: e };
    }
    const collections = await VillageCollection.find(filter)
      .sort({ date: -1 })
      .populate('villageId', 'name code');
    res.json({ success: true, data: collections });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching collections', error: error.message });
  }
});

// POST / - create a collection record; auto-compute amountCollected from payment history on that date
router.post('/', async (req, res) => {
  try {
    const { villageId, villageName, householdsCollected, date, customers, amountCollected, amount } = req.body;
    if (!villageId || !mongoose.Types.ObjectId.isValid(villageId)) {
      // Try to find village by name if no valid id
      if (villageName && typeof villageName === 'string') {
        const Village = mongoose.model('Village');
        const existing = await Village.findOne({ name: villageName });
        if (existing) {
          req.body.villageId = existing._id;
        }
      } else {
        req.body.villageId = undefined;
      }
    }
    // Allow alias 'customers' for householdsCollected
    const householdsValue = (customers !== undefined && customers !== null) ? Number(customers) : Number(householdsCollected);
    if (householdsValue === undefined || householdsValue === null || isNaN(householdsValue)) {
      return res.status(400).json({ success: false, message: 'customers (number of households/customers) is required' });
    }
    const effectiveDate = date ? new Date(date) : new Date();

    const s = startOfDay(effectiveDate);
    const e = endOfDay(effectiveDate);

    // If amount is provided by client, use it; otherwise compute from payment history
    let computedAmount = undefined;
    if (amountCollected !== undefined || amount !== undefined) {
      computedAmount = Number(amountCollected ?? amount) || 0;
    } else {
      const villageCustomers = await Customer.find({
        $or: [
          { villageId: villageId },
          { 'villageId._id': villageId }
        ]
      }).lean();
      let sum = 0;
      for (const cust of villageCustomers) {
        const history = Array.isArray(cust.paymentHistory) ? cust.paymentHistory : [];
        const entriesToday = history.filter(h => {
          if (!h.date) return false;
          const hd = new Date(h.date);
          return hd >= s && hd <= e;
        });
        for (const h of entriesToday) {
          const paid = Number(h.paid) || 0;
          sum += paid;
        }
      }
      computedAmount = sum;
    }

    const doc = new VillageCollection({
      villageId: req.body.villageId || villageId,
      villageName: villageName,
      date: effectiveDate,
      householdsCollected: Math.max(0, Number(householdsValue) || 0),
      amountCollected: Math.max(0, Number(computedAmount) || 0)
    });
    await doc.save();
    await doc.populate('villageId', 'name code');
    res.status(201).json({ success: true, data: doc, message: 'Village collection recorded' });
  } catch (error) {
    // Handle duplicate per-day per-village gracefully
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Collection for this village and date already exists' });
    }
    res.status(500).json({ success: false, message: 'Error creating collection', error: error.message });
  }
});

// DELETE /:id - remove a collection record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await VillageCollection.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    res.json({ success: true, message: 'Collection deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting collection', error: error.message });
  }
});

// Update a collection
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { villageId, villageName, customers, householdsCollected, amountCollected, amount, date } = req.body;
    const update = {};
    if (villageId && mongoose.Types.ObjectId.isValid(villageId)) update.villageId = villageId;
    if (villageName) update.villageName = villageName;
    const householdsValue = (customers !== undefined && customers !== null) ? Number(customers) : Number(householdsCollected);
    if (!isNaN(householdsValue)) update.householdsCollected = Math.max(0, householdsValue);
    const amountValue = (amountCollected !== undefined && amountCollected !== null) ? Number(amountCollected) : Number(amount);
    if (!isNaN(amountValue)) update.amountCollected = Math.max(0, amountValue);
    if (date) update.date = new Date(date);
    const updated = await VillageCollection.findByIdAndUpdate(id, update, { new: true }).populate('villageId', 'name code');
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Collection not found' });
    }
    res.json({ success: true, data: updated, message: 'Village collection updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating collection', error: error.message });
  }
});

module.exports = router;
