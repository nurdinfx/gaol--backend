const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://goalfrontend-chi.vercel.app',
  'https://goalfrontend-km2o.vercel.app',
  'https://goalfrontend.vercel.app'
];
const envAllowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envAllowedOrigins]))
  .map(origin => origin.replace(/\/$/, ''));

// Enhanced Vercel detection
const isAllowedVercelOrigin = (origin = '') => {
  try {
    const url = new URL(origin);
    // Allow all Vercel preview URLs for this project
    return (url.protocol === 'https:' && 
           url.hostname.endsWith('.vercel.app') && 
           url.hostname.includes('goalfrontend')) ||
           url.hostname === 'goalfrontend.vercel.app';
  } catch {
    return false;
  }
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const normalized = origin.replace(/\/$/, '');
    
    if (allowedOrigins.includes(normalized) || isAllowedVercelOrigin(normalized)) {
      return callback(null, true);
    }
    
    console.log('🔒 CORS blocked origin:', origin);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/garbage-management')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const carRoutes = require('./routes/cars');
const driverRoutes = require('./routes/drivers');
const villageRoutes = require('./routes/villages');
const customerRoutes = require('./routes/customers');
const workerRoutes = require('./routes/workers');
const dashboardRoutes = require('./routes/dashboard');
const paymentRoutes = require('./routes/payments');
const employeeRoutes = require('./routes/employees');
const withdrawRoutes = require('./routes/withdraws');
const userRoutes = require('./routes/users');
const villageCollectionsRoutes = require('./routes/villageCollections');
const CompanyExpense = require('./models/CompanyExpense');

// ==================== ZONES ROUTES ====================
const zonesRoutes = express.Router();

// In-memory storage for zones (fallback if database not available)
let zones = [];
let zoneIdCounter = 1;

// Get all zones
zonesRoutes.get('/', async (req, res) => {
  try {
    console.log('📍 Fetching all zones');
    
    // Try to get zones from database first
    let zonesData = [];
    try {
      // Check if Zone model exists, if not use in-memory
      let Zone;
      try {
        Zone = require('./models/Zone');
        zonesData = await Zone.find().sort({ zoneNumber: 1 });
        console.log(`✅ Loaded ${zonesData.length} zones from database`);
      } catch (modelError) {
        console.log('📋 Zone model not found, using in-memory data');
        zonesData = zones;
      }
    } catch (dbError) {
      console.log('📋 Database error, using in-memory zones data');
      zonesData = zones;
    }
    
    res.json({
      success: true,
      data: zonesData,
      message: 'Zones fetched successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching zones',
      error: error.message
    });
  }
});

// Get single zone
zonesRoutes.get('/:id', async (req, res) => {
  try {
    const zoneId = req.params.id;
    console.log('📍 Fetching zone:', zoneId);
    
    let zone;
    try {
      let Zone;
      try {
        Zone = require('./models/Zone');
        zone = await Zone.findById(zoneId);
      } catch (modelError) {
        console.log('📋 Zone model not found, using in-memory data');
        zone = zones.find(z => z._id === zoneId);
      }
    } catch (dbError) {
      console.log('📋 Database error, using in-memory data');
      zone = zones.find(z => z._id === zoneId);
    }
    
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: 'Zone not found'
      });
    }

    res.json({
      success: true,
      data: zone,
      message: 'Zone fetched successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching zone',
      error: error.message
    });
  }
});

// Create new zone
zonesRoutes.post('/', async (req, res) => {
  try {
    console.log('📍 Creating new zone:', req.body);
    
    const { name, description, supervisor, contactNumber, notes, zoneNumber } = req.body;

    // Validate required fields
    if (!name || !zoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Zone name and zone number are required'
      });
    }

    let newZone;
    
    try {
      // Try to save to database
      let Zone;
      try {
        Zone = require('./models/Zone');
        
        // Check if zone number already exists
        const existingZone = await Zone.findOne({ zoneNumber });
        if (existingZone) {
          return res.status(400).json({
            success: false,
            message: 'Zone number already exists'
          });
        }

        newZone = new Zone({
          name,
          description: description || '',
          supervisor: supervisor || '',
          contactNumber: contactNumber || '',
          notes: notes || '',
          zoneNumber,
          code: `ZONE${String(zoneNumber).padStart(3, '0')}`,
          status: 'active'
        });

        await newZone.save();
        console.log('✅ Zone saved to database:', newZone);
      } catch (modelError) {
        console.log('📋 Zone model not found, saving to in-memory storage');
        // Fallback to in-memory storage
        newZone = {
          _id: `zone_${zoneIdCounter++}`,
          name,
          description: description || '',
          supervisor: supervisor || '',
          contactNumber: contactNumber || '',
          notes: notes || '',
          zoneNumber,
          code: `ZONE${String(zoneNumber).padStart(3, '0')}`,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        zones.push(newZone);
      }
    } catch (dbError) {
      console.log('📋 Database error, saving to in-memory storage');
      // Fallback to in-memory storage
      newZone = {
        _id: `zone_${zoneIdCounter++}`,
        name,
        description: description || '',
        supervisor: supervisor || '',
        contactNumber: contactNumber || '',
        notes: notes || '',
        zoneNumber,
        code: `ZONE${String(zoneNumber).padStart(3, '0')}`,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      zones.push(newZone);
    }
    
    console.log('✅ Zone created:', newZone);
    
    res.status(201).json({
      success: true,
      data: newZone,
      message: 'Zone created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating zone',
      error: error.message
    });
  }
});

// Update zone
zonesRoutes.put('/:id', async (req, res) => {
  try {
    const zoneId = req.params.id;
    console.log('🔄 Updating zone:', zoneId, req.body);
    
    const { name, description, supervisor, contactNumber, notes, status } = req.body;

    let updatedZone;
    
    try {
      let Zone;
      try {
        Zone = require('./models/Zone');
        updatedZone = await Zone.findByIdAndUpdate(
          zoneId,
          {
            name,
            description,
            supervisor,
            contactNumber,
            notes,
            status,
            updatedAt: new Date()
          },
          { new: true, runValidators: true }
        );
        
        if (!updatedZone) {
          return res.status(404).json({
            success: false,
            message: 'Zone not found'
          });
        }
        console.log('✅ Zone updated in database:', updatedZone);
      } catch (modelError) {
        console.log('📋 Zone model not found, updating in-memory data');
        // Update in-memory data
        const zoneIndex = zones.findIndex(z => z._id === zoneId);
        if (zoneIndex === -1) {
          return res.status(404).json({
            success: false,
            message: 'Zone not found'
          });
        }
        
        updatedZone = {
          ...zones[zoneIndex],
          name,
          description,
          supervisor,
          contactNumber,
          notes,
          status,
          updatedAt: new Date()
        };
        zones[zoneIndex] = updatedZone;
      }
    } catch (dbError) {
      console.log('📋 Database error, updating in-memory data');
      // Update in-memory data
      const zoneIndex = zones.findIndex(z => z._id === zoneId);
      if (zoneIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Zone not found'
        });
      }
      
      updatedZone = {
        ...zones[zoneIndex],
        name,
        description,
        supervisor,
        contactNumber,
        notes,
        status,
        updatedAt: new Date()
      };
      zones[zoneIndex] = updatedZone;
    }

    console.log('✅ Zone updated:', updatedZone);

    res.json({
      success: true,
      data: updatedZone,
      message: 'Zone updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating zone',
      error: error.message
    });
  }
});

// Delete zone
zonesRoutes.delete('/:id', async (req, res) => {
  try {
    const zoneId = req.params.id;
    console.log('🗑️ Deleting zone:', zoneId);
    
    try {
      let Zone;
      try {
        Zone = require('./models/Zone');
        const deletedZone = await Zone.findByIdAndDelete(zoneId);
        
        if (!deletedZone) {
          return res.status(404).json({
            success: false,
            message: 'Zone not found'
          });
        }
        console.log('✅ Zone deleted from database:', deletedZone);
      } catch (modelError) {
        console.log('📋 Zone model not found, deleting from in-memory data');
        // Delete from in-memory data
        const zoneIndex = zones.findIndex(z => z._id === zoneId);
        if (zoneIndex === -1) {
          return res.status(404).json({
            success: false,
            message: 'Zone not found'
          });
        }
        
        const deletedZone = zones.splice(zoneIndex, 1);
        console.log('✅ Zone deleted from memory:', deletedZone[0]);
      }
    } catch (dbError) {
      console.log('📋 Database error, deleting from in-memory data');
      // Delete from in-memory data
      const zoneIndex = zones.findIndex(z => z._id === zoneId);
      if (zoneIndex === -1) {
        return res.status(404).json({
            success: false,
            message: 'Zone not found'
        });
      }
      
      const deletedZone = zones.splice(zoneIndex, 1);
      console.log('✅ Zone deleted from memory:', deletedZone[0]);
    }

    res.json({
      success: true,
      message: 'Zone deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting zone:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting zone',
      error: error.message
    });
  }
});

// Seed sample zones data
zonesRoutes.post('/seed', async (req, res) => {
  try {
    console.log('🌱 Seeding sample zones data');
    
    // Sample zones data
    const sampleZones = [
      {
        _id: 'zone_1',
        name: 'North Zone',
        description: 'Northern residential areas',
        supervisor: 'John Smith',
        contactNumber: '+1234567890',
        notes: 'High density residential area',
        zoneNumber: 1,
        code: 'ZONE001',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        _id: 'zone_2',
        name: 'South Zone',
        description: 'Southern commercial areas',
        supervisor: 'Maria Garcia',
        contactNumber: '+1234567891',
        notes: 'Commercial and business district',
        zoneNumber: 2,
        code: 'ZONE002',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        _id: 'zone_3',
        name: 'East Zone',
        description: 'Eastern industrial areas',
        supervisor: 'Ahmed Khan',
        contactNumber: '+1234567892',
        notes: 'Industrial and manufacturing area',
        zoneNumber: 3,
        code: 'ZONE003',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        _id: 'zone_4',
        name: 'West Zone',
        description: 'Western suburban areas',
        supervisor: 'Sarah Johnson',
        contactNumber: '+1234567893',
        notes: 'Low density suburban area',
        zoneNumber: 4,
        code: 'ZONE004',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      },
      {
        _id: 'zone_5',
        name: 'Central Zone',
        description: 'Central business district',
        supervisor: 'David Brown',
        contactNumber: '+1234567894',
        notes: 'CBD and government buildings',
        zoneNumber: 5,
        code: 'ZONE005',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      }
    ];

    // Try to save to database
    try {
      let Zone;
      try {
        Zone = require('./models/Zone');
        await Zone.deleteMany({}); // Clear existing data
        await Zone.insertMany(sampleZones);
        console.log('✅ Sample zones data seeded to database');
      } catch (modelError) {
        console.log('📋 Zone model not found, seeding in-memory data');
        zones = sampleZones;
        zoneIdCounter = 6;
      }
    } catch (dbError) {
      console.log('📋 Database error, seeding in-memory data');
      zones = sampleZones;
      zoneIdCounter = 6;
    }

    res.json({
      success: true,
      data: sampleZones,
      message: 'Sample zones data seeded successfully'
    });
  } catch (error) {
    console.error('❌ Error seeding zones:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding zones',
      error: error.message
    });
  }
});

// ==================== COMPANY EXPENSES ROUTES ====================
const companyExpensesRouter = express.Router();

companyExpensesRouter.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching all company expenses from database');
    const expenses = await CompanyExpense.find().sort({ date: -1, createdAt: -1 });
    res.json({
      success: true,
      data: expenses,
      message: 'Company expenses fetched successfully'
    });
  } catch (error) {
    console.error('❌ Error fetching company expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company expenses',
      error: error.message
    });
  }
});

companyExpensesRouter.post('/', async (req, res) => {
  try {
    console.log('💰 Creating new company expense:', req.body);

    const amount = parseFloat(req.body.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!req.body.type || !req.body.type.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Expense type is required'
      });
    }

    const expense = await CompanyExpense.create({
      type: req.body.type.trim(),
      amount,
      category: req.body.category || 'general',
      employeeName: req.body.employeeName || '',
      notes: req.body.notes || '',
      description: req.body.description || '',
      date: req.body.date ? new Date(req.body.date) : new Date()
    });

    console.log('✅ Company expense stored in database:', expense);

    res.status(201).json({
      success: true,
      data: expense,
      message: 'Company expense created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating company expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating company expense',
      error: error.message
    });
  }
});

companyExpensesRouter.put('/:id', async (req, res) => {
  try {
    const updates = { updatedAt: new Date() };

    if (req.body.type !== undefined) {
      if (!req.body.type.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Expense type cannot be empty'
        });
      }
      updates.type = req.body.type.trim();
    }

    if (req.body.amount !== undefined) {
      const amount = parseFloat(req.body.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Amount must be greater than 0'
        });
      }
      updates.amount = amount;
    }

    if (req.body.category !== undefined) updates.category = req.body.category;
    if (req.body.employeeName !== undefined) updates.employeeName = req.body.employeeName;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.date) updates.date = new Date(req.body.date);

    const expense = await CompanyExpense.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Company expense not found'
      });
    }

    res.json({
      success: true,
      data: expense,
      message: 'Company expense updated successfully'
    });
  } catch (error) {
    console.error('❌ Error updating company expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating company expense',
      error: error.message
    });
  }
});

companyExpensesRouter.delete('/:id', async (req, res) => {
  try {
    const expense = await CompanyExpense.findByIdAndDelete(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Company expense not found'
      });
    }

    res.json({
      success: true,
      message: 'Company expense deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting company expense:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting company expense',
      error: error.message
    });
  }
});

companyExpensesRouter.get('/summary', async (req, res) => {
  try {
    console.log('📊 Calculating company expenses summary');

    const expenses = await CompanyExpense.find();
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const expensesByType = expenses.reduce((acc, expense) => {
      acc[expense.type] = (acc[expense.type] || 0) + (expense.amount || 0);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalExpenses,
        totalRecords: expenses.length,
        expensesByType
      }
    });
  } catch (error) {
    console.error('❌ Error fetching expense summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching expense summary',
      error: error.message
    });
  }
});

companyExpensesRouter.post('/seed', async (req, res) => {
  try {
    console.log('🌱 Seeding sample company expenses');
    await CompanyExpense.deleteMany({});

    const sampleExpenses = [
      {
        type: 'salary',
        description: 'Monthly driver salaries',
        amount: 2500,
        employeeName: 'John Driver',
        category: 'Payroll',
        notes: 'Regular monthly salary',
        date: new Date('2024-01-15')
      },
      {
        type: 'fuel',
        description: 'Diesel fuel purchase',
        amount: 850.75,
        category: 'Operations',
        notes: 'Weekly fuel purchase',
        date: new Date('2024-01-10')
      },
      {
        type: 'maintenance',
        description: 'Truck engine repair',
        amount: 1200,
        category: 'Vehicle Maintenance',
        notes: 'Engine overhaul for truck #5',
        date: new Date('2024-01-08')
      }
    ];

    const created = await CompanyExpense.insertMany(sampleExpenses);

    res.json({
      success: true,
      data: created,
      message: 'Sample company expenses seeded successfully'
    });
  } catch (error) {
    console.error('❌ Error seeding company expenses:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding company expenses',
      error: error.message
    });
  }
});

// ==================== ADVANCE PAYMENT ROUTES ====================
const advancePaymentRoutes = express.Router();

// Temporary advance payment routes
advancePaymentRoutes.get('/', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Advance payments endpoint - no payments found'
  });
});

advancePaymentRoutes.get('/worker/:workerId', (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'No advance payments found for this worker'
  });
});

advancePaymentRoutes.post('/', (req, res) => {
  console.log('💰 Advance payment received:', req.body);
  
  const { workerId, amount, description, date, type } = req.body;
  
  // Create a mock response
  const mockPayment = {
    _id: Date.now().toString(),
    workerId,
    amount: parseFloat(amount),
    description: description || 'Advance payment',
    date: date || new Date().toISOString(),
    type: type || 'advance',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  res.status(201).json({
    success: true,
    data: mockPayment,
    message: 'Advance payment created successfully'
  });
});

advancePaymentRoutes.delete('/:id', (req, res) => {
  res.json({
    success: true,
    message: 'Advance payment deleted successfully'
  });
});

// ==================== USE ALL ROUTES ====================
app.use('/api/auth', authRoutes);
app.use('/api/cars', carRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/villages', villageRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/zones', zonesRoutes); // Add zones routes
app.use('/api/company-expenses', companyExpensesRouter); // Company expenses routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/village-collections', villageCollectionsRoutes);

// ==================== FIX: ADD BOTH WITHDRAW ROUTES ====================
// Mount withdraw routes at both endpoints for compatibility
app.use('/api/withdrawals', withdrawRoutes); // For backend consistency
app.use('/api/withdraws', withdrawRoutes);    // For frontend compatibility

app.use('/api/advance-payments', advancePaymentRoutes);
app.use('/api/users', userRoutes); // User management routes

// ==================== HEALTH CHECK & TEST ROUTES ====================
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'All routes working!',
    endpoints: [
      '/api/auth/login',
      '/api/cars',
      '/api/drivers',
      '/api/villages',
      '/api/customers', 
      '/api/workers',
      '/api/zones',
      '/api/zones/seed',
      '/api/company-expenses',
      '/api/company-expenses/summary',
      '/api/company-expenses/seed',
      '/api/dashboard/stats',
      '/api/payments',
      '/api/employees',
      '/api/withdrawals',
      '/api/withdraws', // Added for compatibility
      '/api/advance-payments',
      '/api/health'
    ]
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔗 Test: http://localhost:${PORT}/api/test`);
  console.log(`📍 Zones: http://localhost:${PORT}/api/zones`);
  console.log(`🌱 Zones Seed: http://localhost:${PORT}/api/zones/seed`);
  console.log(`💰 Company Expenses: http://localhost:${PORT}/api/company-expenses`);
  console.log(`📊 Company Expenses Summary: http://localhost:${PORT}/api/company-expenses/summary`);
  console.log(`🌱 Company Expenses Seed: http://localhost:${PORT}/api/company-expenses/seed`);
  console.log(`💰 Withdrawals: http://localhost:${PORT}/api/withdrawals`);
  console.log(`💰 Withdraws (compatibility): http://localhost:${PORT}/api/withdraws`);
  console.log(`💰 Advance Payments: http://localhost:${PORT}/api/advance-payments`);
});
