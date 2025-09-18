import { BaseNotificationChannel } from './BaseNotificationChannel';
import { IAlert, IUser, DeliveryType, NotificationStatus } from '@/types';
import { NotificationDelivery } from '@/models';

export class InAppNotificationChannel extends BaseNotificationChannel {
  constructor() {
    super(DeliveryType.IN_APP);
  }

  public async send(alert: IAlert, user: IUser): Promise<boolean> {
    try {
      // Check if notification already exists for this alert-user combination
      const existingDelivery = await NotificationDelivery.findOne({
        alertId: alert._id,
        userId: user._id,
        deliveryType: this.deliveryType
      });

      if (existingDelivery) {
        // Update existing delivery if it's not yet delivered
        if (existingDelivery.status === NotificationStatus.PENDING) {
          existingDelivery.status = NotificationStatus.DELIVERED;
          existingDelivery.deliveredAt = new Date();
          await existingDelivery.save();
        }
        return true;
      }

      // Create new notification delivery record
      const delivery = new NotificationDelivery({
        alertId: alert._id,
        userId: user._id,
        deliveryType: this.deliveryType,
        status: NotificationStatus.DELIVERED,
        deliveredAt: new Date(),
        metadata: {
          formattedTitle: this.formatTitle(alert),
          formattedMessage: this.formatMessage(alert, user),
          severity: alert.severity,
          reminderCount: 0
        }
      });

      await delivery.save();

      console.log(`📱 In-app notification sent to ${user.name} for alert: ${alert.title}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send in-app notification to ${user.name}:`, error);
      return false;
    }
  }

  // Method to mark notification as read
  public async markAsRead(alertId: string, userId: string): Promise<boolean> {
    try {
      const delivery = await NotificationDelivery.findOne({
        alertId,
        userId,
        deliveryType: this.deliveryType
      });

      if (delivery && delivery.status !== NotificationStatus.READ) {
        delivery.status = NotificationStatus.READ;
        delivery.readAt = new Date();
        await delivery.save();
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      return false;
    }
  }

  // Method to snooze notification
  public async snooze(alertId: string, userId: string, hours: number = 24): Promise<boolean> {
    try {
      const delivery = await NotificationDelivery.findOne({
        alertId,
        userId,
        deliveryType: this.deliveryType
      });

      if (delivery) {
        delivery.status = NotificationStatus.SNOOZED;
        delivery.snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
        await delivery.save();
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to snooze notification:', error);
      return false;
    }
  }

  // Method to get user's notifications
  public async getUserNotifications(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const deliveries = await NotificationDelivery.find({
        userId,
        deliveryType: this.deliveryType
      })
      .populate('alertId')
      .sort({ createdAt: -1 })
      .limit(limit);

      return deliveries.map(delivery => ({
        id: delivery._id,
        alert: delivery.alertId,
        status: delivery.status,
        deliveredAt: delivery.deliveredAt,
        readAt: delivery.readAt,
        snoozedUntil: delivery.snoozedUntil,
        metadata: delivery.metadata,
        createdAt: delivery.createdAt
      }));
    } catch (error) {
      console.error('❌ Failed to get user notifications:', error);
      return [];
    }
  }
}
