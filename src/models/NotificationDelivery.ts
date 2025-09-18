import { Schema, model } from 'mongoose';
import { INotificationDelivery, DeliveryType, NotificationStatus } from '@/types';

const notificationDeliverySchema = new Schema<INotificationDelivery>({
  alertId: {
    type: Schema.Types.ObjectId,
    ref: 'Alert',
    required: [true, 'Alert ID is required']
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  deliveryType: {
    type: String,
    enum: Object.values(DeliveryType),
    required: [true, 'Delivery type is required']
  },
  status: {
    type: String,
    enum: Object.values(NotificationStatus),
    default: NotificationStatus.PENDING,
    required: true
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  snoozedUntil: {
    type: Date,
    default: null
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
notificationDeliverySchema.index({ alertId: 1, userId: 1 });
notificationDeliverySchema.index({ userId: 1, status: 1 });
notificationDeliverySchema.index({ alertId: 1, status: 1 });
notificationDeliverySchema.index({ deliveredAt: 1 });
notificationDeliverySchema.index({ snoozedUntil: 1 });

// Compound indexes for common queries
notificationDeliverySchema.index({ alertId: 1, userId: 1, deliveryType: 1 }, { unique: true });
notificationDeliverySchema.index({ userId: 1, status: 1, deliveredAt: -1 });

// Virtual to check if notification is currently snoozed
notificationDeliverySchema.virtual('isSnoozed').get(function() {
  return this.status === NotificationStatus.SNOOZED && 
         this.snoozedUntil && 
         this.snoozedUntil > new Date();
});

// Virtual to check if snooze has expired
notificationDeliverySchema.virtual('isSnoozeExpired').get(function() {
  return this.status === NotificationStatus.SNOOZED && 
         this.snoozedUntil && 
         this.snoozedUntil <= new Date();
});

// Pre-save middleware to update timestamps based on status
notificationDeliverySchema.pre<INotificationDelivery>('save', function(next) {
  const now = new Date();
  
  // Set delivered timestamp when status changes to delivered
  if (this.isModified('status') && this.status === NotificationStatus.DELIVERED && !this.deliveredAt) {
    this.deliveredAt = now;
  }
  
  // Set read timestamp when status changes to read
  if (this.isModified('status') && this.status === NotificationStatus.READ && !this.readAt) {
    this.readAt = now;
  }
  
  // Reset snooze if status is no longer snoozed
  if (this.isModified('status') && this.status !== NotificationStatus.SNOOZED) {
    this.snoozedUntil = null;
  }
  
  next();
});

// Static method to find pending deliveries
notificationDeliverySchema.statics.findPending = function() {
  return this.find({ status: NotificationStatus.PENDING });
};

// Static method to find deliveries for user
notificationDeliverySchema.statics.findForUser = function(userId: string, statuses?: NotificationStatus[]) {
  const query: any = { userId };
  if (statuses && statuses.length > 0) {
    query.status = { $in: statuses };
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find expired snoozes
notificationDeliverySchema.statics.findExpiredSnoozes = function() {
  const now = new Date();
  return this.find({
    status: NotificationStatus.SNOOZED,
    snoozedUntil: { $lte: now }
  });
};

// Instance method to mark as delivered
notificationDeliverySchema.methods.markAsDelivered = function() {
  this.status = NotificationStatus.DELIVERED;
  this.deliveredAt = new Date();
  return this.save();
};

// Instance method to mark as read
notificationDeliverySchema.methods.markAsRead = function() {
  this.status = NotificationStatus.READ;
  this.readAt = new Date();
  return this.save();
};

// Instance method to snooze
notificationDeliverySchema.methods.snooze = function(hours: number = 24) {
  this.status = NotificationStatus.SNOOZED;
  this.snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  return this.save();
};

// Instance method to unsnooze
notificationDeliverySchema.methods.unsnooze = function() {
  this.status = NotificationStatus.DELIVERED;
  this.snoozedUntil = null;
  return this.save();
};

export const NotificationDelivery = model<INotificationDelivery>('NotificationDelivery', notificationDeliverySchema);
