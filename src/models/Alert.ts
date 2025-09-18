import { Schema, model } from 'mongoose';
import { IAlert, AlertSeverity, DeliveryType, VisibilityType, AlertStatus } from '@/types';

const alertSchema = new Schema<IAlert>({
  title: {
    type: String,
    required: [true, 'Alert title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Alert message is required'],
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  severity: {
    type: String,
    enum: Object.values(AlertSeverity),
    required: [true, 'Severity is required'],
    default: AlertSeverity.INFO
  },
  deliveryType: {
    type: String,
    enum: Object.values(DeliveryType),
    required: [true, 'Delivery type is required'],
    default: DeliveryType.IN_APP
  },
  reminderFrequencyMinutes: {
    type: Number,
    default: 120, // 2 hours
    min: [1, 'Reminder frequency must be at least 1 minute'],
    max: [10080, 'Reminder frequency cannot exceed 1 week (10080 minutes)']
  },
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiryTime: {
    type: Date,
    validate: {
      validator: function(this: IAlert, value: Date) {
        return !value || value > this.startTime;
      },
      message: 'Expiry time must be after start time'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isReminderEnabled: {
    type: Boolean,
    default: true
  },
  visibility: {
    type: {
      type: String,
      enum: Object.values(VisibilityType),
      required: [true, 'Visibility type is required']
    },
    targetIds: [{
      type: Schema.Types.ObjectId,
      required: true
    }]
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  status: {
    type: String,
    enum: Object.values(AlertStatus),
    default: AlertStatus.ACTIVE
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
alertSchema.index({ status: 1, isActive: 1 });
alertSchema.index({ createdBy: 1 });
alertSchema.index({ startTime: 1, expiryTime: 1 });
alertSchema.index({ 'visibility.type': 1, 'visibility.targetIds': 1 });
alertSchema.index({ severity: 1 });
alertSchema.index({ deliveryType: 1 });

// Compound indexes for common queries
alertSchema.index({ status: 1, severity: 1, isActive: 1 });
alertSchema.index({ startTime: 1, expiryTime: 1, isActive: 1 });

// Virtual for checking if alert is currently active
alertSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.isActive && 
         this.status === AlertStatus.ACTIVE &&
         this.startTime <= now &&
         (!this.expiryTime || this.expiryTime > now);
});

// Virtual for checking if alert is expired
alertSchema.virtual('isExpired').get(function() {
  const now = new Date();
  return this.expiryTime && this.expiryTime <= now;
});

// Pre-save middleware to update status based on expiry
alertSchema.pre<IAlert>('save', function(next) {
  const now = new Date();
  
  // Auto-expire if expiry time has passed
  if (this.expiryTime && this.expiryTime <= now && this.status === AlertStatus.ACTIVE) {
    this.status = AlertStatus.EXPIRED;
    this.isActive = false;
  }
  
  next();
});

// Static method to find active alerts
alertSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    status: AlertStatus.ACTIVE,
    startTime: { $lte: now },
    $or: [
      { expiryTime: { $exists: false } },
      { expiryTime: { $gt: now } }
    ]
  });
};

// Static method to find alerts for specific user
alertSchema.statics.findForUser = function(userId: string, teamId?: string) {
  const now = new Date();
  
  const query: any = {
    isActive: true,
    status: AlertStatus.ACTIVE,
    startTime: { $lte: now },
    $and: [
      {
        $or: [
          { expiryTime: { $exists: false } },
          { expiryTime: { $gt: now } }
        ]
      },
      {
        $or: [
          // Organization-wide alerts
          { 'visibility.type': VisibilityType.ORGANIZATION },
          // User-specific alerts
          { 'visibility.type': VisibilityType.USER, 'visibility.targetIds': userId }
        ]
      }
    ]
  };

  // Add team-specific alerts if user has a team
  if (teamId) {
    query.$and[1].$or.push({
      'visibility.type': VisibilityType.TEAM,
      'visibility.targetIds': teamId
    });
  }

  return this.find(query);
};

// Instance method to check if alert should remind user
alertSchema.methods.shouldRemindUser = function(lastReminderSent?: Date): boolean {
  if (!this.isReminderEnabled || !this.isCurrentlyActive) {
    return false;
  }

  if (!lastReminderSent) {
    return true; // First reminder
  }

  const timeSinceLastReminder = Date.now() - lastReminderSent.getTime();
  const reminderIntervalMs = this.reminderFrequencyMinutes * 60 * 1000;
  
  return timeSinceLastReminder >= reminderIntervalMs;
};

export const Alert = model<IAlert>('Alert', alertSchema);
