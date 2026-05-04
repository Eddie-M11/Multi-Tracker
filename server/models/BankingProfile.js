const mongoose = require('mongoose');

const payScheduleSchema = new mongoose.Schema(
  {
    configured: {
      type: Boolean,
      default: false,
    },
    incomeName: {
      type: String,
      trim: true,
      default: '',
    },
    payerName: {
      type: String,
      trim: true,
      default: '',
    },
    netPayAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    frequency: {
      type: String,
      enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
      default: 'biweekly',
    },
    nextPayDate: {
      type: Date,
      default: null,
    },
    payDayOne: {
      type: Number,
      default: null,
      min: 1,
      max: 31,
    },
    payDayTwo: {
      type: Number,
      default: null,
      min: 1,
      max: 31,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const aprSchema = new mongoose.Schema(
  {
    aprPercentage: {
      type: Number,
      default: null,
      min: 0,
    },
    aprType: {
      type: String,
      enum: ['balance_transfer_apr', 'cash_apr', 'purchase_apr', 'special', 'unknown'],
      default: 'unknown',
    },
    balanceSubjectToApr: {
      type: Number,
      default: null,
    },
    interestChargeAmount: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const bankingAccountSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['manual', 'plaid'],
      default: 'manual',
    },
    plaidAccountId: {
      type: String,
      trim: true,
      default: '',
    },
    plaidItemId: {
      type: String,
      trim: true,
      default: '',
    },
    plaidEnvironment: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    institutionName: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    officialName: {
      type: String,
      trim: true,
      default: '',
    },
    mask: {
      type: String,
      trim: true,
      default: '',
    },
    accountCategory: {
      type: String,
      enum: ['checking', 'savings', 'credit-card', 'other'],
      default: 'checking',
    },
    plaidType: {
      type: String,
      trim: true,
      default: '',
    },
    plaidSubtype: {
      type: String,
      trim: true,
      default: '',
    },
    allocationType: {
      type: String,
      enum: ['percent', 'fixed', 'remaining', 'none'],
      default: 'percent',
    },
    allocationValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
    availableBalance: {
      type: Number,
      default: null,
    },
    creditLimit: {
      type: Number,
      default: null,
    },
    isoCurrencyCode: {
      type: String,
      trim: true,
      default: 'USD',
    },
    minimumPaymentAmount: {
      type: Number,
      default: null,
    },
    nextPaymentDueDate: {
      type: Date,
      default: null,
    },
    lastStatementBalance: {
      type: Number,
      default: null,
    },
    lastStatementIssueDate: {
      type: Date,
      default: null,
    },
    purchaseApr: {
      type: Number,
      default: null,
      min: 0,
    },
    aprs: {
      type: [aprSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'hidden'],
      default: 'active',
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const plaidItemSchema = new mongoose.Schema(
  {
    plaidItemId: {
      type: String,
      required: true,
      trim: true,
    },
    environment: {
      type: String,
      enum: ['sandbox', 'production'],
      default: 'sandbox',
    },
    accessToken: {
      type: String,
      required: true,
    },
    institutionId: {
      type: String,
      trim: true,
      default: '',
    },
    institutionName: {
      type: String,
      trim: true,
      default: '',
    },
    products: {
      type: [String],
      default: [],
    },
    transactionCursor: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'error'],
      default: 'active',
    },
    errorCode: {
      type: String,
      trim: true,
      default: '',
    },
    errorMessage: {
      type: String,
      trim: true,
      default: '',
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const bankingProfileSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    paySchedule: {
      type: payScheduleSchema,
      default: () => ({}),
    },
    accounts: {
      type: [bankingAccountSchema],
      default: [],
    },
    plaidItems: {
      type: [plaidItemSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankingProfile', bankingProfileSchema);
