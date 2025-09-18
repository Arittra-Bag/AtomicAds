import { Schema, model } from 'mongoose';
import { IUserAlertPreference } from '@/types';

const userAlertPreferenceSchema = new Schema<IUserAlertPreference>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  alertId: {
    type: Schema.Types.ObjectId,
    ref: 'Alert',
    required: [true, 'Alert ID is required']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isSnoozed: {
    type: Boolean,
    default: false
  },
  snoozedUntil: {
    type: Date,
    default: null
  },
  lastReminderSent: {
    type: Date,
    default: null
  },
  reminderCount: {
    type: Number,
    default: 0,
    min: [0, 'Reminder count cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userAlertPreferenceSchema.index({ userId: 1, alertId: 1 }, { unique: true });
userAlertPreferenceSchema.index({ userId: 1, isRead: 1 });
userAlertPreferenceSchema.index({ userId: 1, isSnoozed: 1 });
userAlertPreferenceSchema.index({ alertId: 1, isSnoozed: 1 });
userAlertPreferenceSchema.index({ snoozedUntil: 1 });
userAlertPreferenceSchema.index({ lastReminderSent: 1 });

// Virtual to check if snooze is currently active
userAlertPreferenceSchema.virtual('isCurrentlySnoozed').get(function() {
  return this.isSnoozed && 
         this.snoozedUntil && 
         this.snoozedUntil > new Date();
});

// Virtual to check if snooze has expired
userAlertPreferenceSchema.virtual('isSnoozeExpired').get(function() {
  return this.isSnoozed && 
         this.snoozedUntil && 
         this.snoozedUntil <= new Date();
});

// Pre-save middleware to handle snooze expiration
userAlertPreferenceSchema.pre<IUserAlertPreference>('save', function(next) {
  // Auto-unsnooze if snooze time has expired
  if (this.isSnoozed && this.snoozedUntil && this.snoozedUntil <= new Date()) {
    this.isSnoozed = false;
    this.snoozedUntil = null;
  }
  
  // Reset snooze data if not snoozed
  if (!this.isSnoozed) {
    this.snoozedUntil = null;
  }
  
  next();
});

// Static method to find preferences for user
userAlertPreferenceSchema.statics.findForUser = function(userId: string, filters?: any) {
  const query = { userId, ...filters };
  return this.find(query).populate('alertId');
};

// Static method to find preferences for alert
userAlertPreferenceSchema.statics.findForAlert = function(alertId: string, filters?: any) {
  const query = { alertId, ...filters };
  return this.find(query).populate('userId');
};

// Static method to find expired snoozes
userAlertPreferenceSchema.statics.findExpiredSnoozes = function() {
  const now = new Date();
  return this.find({
    isSnoozed: true,
    snoozedUntil: { $lte: now }
  });
};

// Static method to find users who need reminders for a specific alert
userAlertPreferenceSchema.statics.findUsersNeedingReminder = function(alertId: string, reminderIntervalMinutes: number) {
  const now = new Date();
  const reminderThreshold = new Date(now.getTime() - reminderIntervalMinutes * 60 * 1000);
  
  return this.find({
    alertId,
    isRead: false,
    $and: [
      {
        $or: [
          { isSnoozed: false },
          { 
            isSnoozed: true, 
            snoozedUntil: { $lte: now }
          }
        ]
      },
      {
        $or: [
          { lastReminderSent: { $exists: false } },
          { lastReminderSent: null },
          { lastReminderSent: { $lte: reminderThreshold } }
        ]
      }
    ]
  }).populate('userId');
};

// Instance method to mark as read
userAlertPreferenceSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Instance method to mark as unread
userAlertPreferenceSchema.methods.markAsUnread = function() {
  this.isRead = false;
  return this.save();
};

// Instance method to snooze
userAlertPreferenceSchema.methods.snooze = function(hours: number = 24) {
  this.isSnoozed = true;
  this.snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Instance method to unsnooze
userAlertPreferenceSchema.methods.unsnooze = function() {
  this.isSnoozed = false;
  this.snoozedUntil = null;
  return this.save();
};

// Instance method to record reminder sent
userAlertPreferenceSchema.methods.recordReminderSent = function() {
  this.lastReminderSent = new Date();
  this.reminderCount += 1;
  return this.save();
};

// Instance method to check if reminder should be sent
userAlertPreferenceSchema.methods.shouldReceiveReminder = function(reminderIntervalMinutes: number): boolean {
  // Don't send reminder if already read
  if (this.isRead) {
    return false;
  }
  
  // Don't send reminder if currently snoozed
  if (this.isCurrentlySnoozed) {
    return false;
  }
  
  // Send reminder if no previous reminder
  if (!this.lastReminderSent) {
    return true;
  }
  
  // Check if enough time has passed since last reminder
  const timeSinceLastReminder = Date.now() - this.lastReminderSent.getTime();
  const reminderIntervalMs = reminderIntervalMinutes * 60 * 1000;
  
  return timeSinceLastReminder >= reminderIntervalMs;
};

export const UserAlertPreference = model<IUserAlertPreference>('UserAlertPreference', userAlertPreferenceSchema);
