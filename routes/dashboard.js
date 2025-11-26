const express = require('express');
const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = {
      totalCustomers: 150,
      totalVillages: 5,
      totalWorkers: 8,
      totalCars: 3,
      monthlyRevenue: 4500
    };
    res.json({ data: stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;