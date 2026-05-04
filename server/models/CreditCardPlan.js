const mongoose = require('mongoose');

const scheduleItemSchema = new mongoose.Schema(
  {
    month: Number,
    dueDate: Date,
    payment: Number,
    purchaseInterest: Number,
    cashAdvanceInterest: Number,
    purchaseBalance: Number,
    cashAdvanceBalance: Number,
    totalBalance: Number,
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    purchasePrincipalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashAdvancePrincipalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    interestCharged: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

const dashboardNoteSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      trim: true,
      required: true,
    },
    text: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1200,
    },
  },
  { timestamps: true }
);

const creditCardPlanSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cardName: {
      type: String,
      required: true,
      trim: true,
    },
    bank: {
      type: String,
      trim: true,
      default: '',
    },
    linkedBankingAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    linkedPlaidAccountId: {
      type: String,
      trim: true,
      default: '',
    },
    linkedInstitutionName: {
      type: String,
      trim: true,
      default: '',
    },
    linkedAccountMask: {
      type: String,
      trim: true,
      default: '',
    },
    balanceSource: {
      type: String,
      enum: ['manual', 'banking'],
      default: 'manual',
    },
    balanceSyncedAt: {
      type: Date,
      default: null,
    },
    sharedToDashboard: {
      type: Boolean,
      default: false,
    },
    sharedAt: {
      type: Date,
      default: null,
    },
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    openDate: {
      type: Date,
      default: null,
    },
    targetPayoffDate: {
      type: Date,
      required: true,
    },
    monthlyDueDay: {
      type: Number,
      required: true,
      min: 1,
      max: 31,
    },
    purchaseBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    cashAdvanceBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalBalance: {
      type: Number,
      required: true,
      min: 0,
    },
    purchaseApr: {
      type: Number,
      required: true,
      min: 0,
    },
    hasCashAdvance: {
      type: Boolean,
      default: false,
    },
    cashAdvanceApr: {
      type: Number,
      default: 0,
      min: 0,
    },
    cashAdvanceDate: {
      type: Date,
      default: null,
    },
    cashAdvanceFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumPayment: {
      type: Number,
      required: true,
      min: 0,
    },
    plannedMonthlyPayment: {
      type: Number,
      required: true,
      min: 0,
    },
    requiredMonthlyPayment: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedInterest: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedPayoffDate: {
      type: Date,
      default: null,
    },
    monthsToPayoff: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'paid_off'],
      default: 'active',
    },
    aiTips: {
      type: [String],
      default: [],
    },
    schedule: [scheduleItemSchema],
    payments: [paymentSchema],
    dashboardNotes: [dashboardNoteSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('CreditCardPlan', creditCardPlanSchema);
