const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const { connectDB } = require('./config/db');

// Import routes
const authRoutes       = require('./routes/authRoutes');
const structureRoutes  = require('./routes/structureRoutes');
const orgTreeRoutes    = require('./routes/organizationTreeRoutes');
const linkRoutes       = require('./routes/linkRoutes');
const usersRoutes      = require('./routes/usersRoutes');
const checklistRoutes  = require('./routes/checklistRoutes');
const auditRoutes      = require('./routes/auditRoutes');
const auditExecRoutes  = require('./routes/auditExecutionRoutes');
const capRoutes        = require('./routes/capRoutes');
const settingsRoutes   = require('./routes/settingsRoutes');
const noticeRoutes      = require('./routes/noticeRoutes');
const auditorProfileRoutes = require('./routes/auditorProfileRoutes');
const learningRoutes = require('./routes/learningRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const myLearningRoutes = require('./routes/myLearningRoutes');
const landingRoutes    = require('./routes/landingRoutes');
const paymentRoutes    = require('./routes/paymentRoutes');
const adminRoutes      = require('./routes/adminRoutes');
const billingCreditRoutes = require('./routes/billingCreditRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

const corsOptions = {
  origin: ['http://localhost:3001','http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true, 
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.options(/.*/, cors(corsOptions));

// Serve uploaded files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Health check route
app.get('/', (req, res) => {
  res.json({
    message: 'Audito API is running',
    version: '3.0'
  });
});

// API Routes
app.use('/api/auth',        authRoutes);
app.use('/api/structure',   structureRoutes);
app.use('/api/org-tree',    orgTreeRoutes);
app.use('/api/links',       linkRoutes);
app.use('/api/users',       usersRoutes);
app.use('/api/checklists',  checklistRoutes);
app.use('/api/audits',           auditRoutes);
app.use('/api/audit-execution', auditExecRoutes);
app.use('/api/caps',            capRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/notices',         noticeRoutes);
app.use('/api/auditor-profile', auditorProfileRoutes);
app.use('/api/learning',        learningRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/my-learning',    myLearningRoutes);
app.use('/api/landing',        landingRoutes);
app.use('/api/payments',       paymentRoutes);
app.use('/api/admin',          adminRoutes);
app.use('/api/billing/credits', billingCreditRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// Start server after successful DB connection
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
