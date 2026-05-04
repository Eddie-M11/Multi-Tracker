require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const connectDB = require('./config/db');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const bankingRoutes = require('./routes/bankingRoutes');
const creditCardPlanRoutes = require('./routes/creditCardPlanRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const goalRoutes = require('./routes/goalRoutes');
const relationshipRoutes = require('./routes/relationshipRoutes');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({ credentials: true }));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/banking', bankingRoutes);
app.use('/api/credit-card-plans', creditCardPlanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/relationship', relationshipRoutes);

const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Database connection failed', error);
    process.exit(1);
  });
