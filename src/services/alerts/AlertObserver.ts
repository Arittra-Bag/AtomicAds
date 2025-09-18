import { IAlertObserver, IAlert, IUser } from '@/types';
import { NotificationStrategy } from '../notifications/NotificationStrategy';
import { UserAlertPreference } from '@/models';

export class NotificationObserver implements IAlertObserver {
  private notificationStrategy: NotificationStrategy;

  constructor(notificationStrategy: NotificationStrategy) {
    this.notificationStrategy = notificationStrategy;
  }

  public async update(alert: IAlert, users: IUser[]): Promise<void> {
    console.log(`🔔 NotificationObserver: Processing alert "${alert.title}" for ${users.length} users`);

    try {
      // Create user preferences for this alert if they don't exist
      await this.createUserPreferences(alert, users);

      // Send notifications to all eligible users
      await this.sendNotifications(alert, users);

    } catch (error) {
      console.error('❌ Error in NotificationObserver:', error);
    }
  }

  private async createUserPreferences(alert: IAlert, users: IUser[]): Promise<void> {
    const preferencePromises = users.map(async (user) => {
      // Check if preference already exists
      const existingPreference = await UserAlertPreference.findOne({
        userId: user._id,
        alertId: alert._id
      });

      if (!existingPreference) {
        // Create new preference record
        const preference = new UserAlertPreference({
          userId: user._id,
          alertId: alert._id,
          isRead: false,
          isSnoozed: false,
          reminderCount: 0
        });

        await preference.save();
        console.log(`📝 Created preference for user ${user.name} and alert ${alert.title}`);
      }
    });

    await Promise.all(preferencePromises);
  }

  private async sendNotifications(alert: IAlert, users: IUser[]): Promise<void> {
    // Filter users who should receive notifications (not snoozed, etc.)
    const eligibleUsers = await this.filterEligibleUsers(alert, users);

    if (eligibleUsers.length === 0) {
      console.log('ℹ️ No eligible users for notification');
      return;
    }

    // Send notifications using the configured delivery type
    const result = await this.notificationStrategy.sendBulkNotifications(
      alert,
      eligibleUsers,
      alert.deliveryType
    );

    console.log(`📊 Notification result: ${result.successful} sent, ${result.failed} failed`);
  }

  private async filterEligibleUsers(alert: IAlert, users: IUser[]): Promise<IUser[]> {
    const eligibleUsers: IUser[] = [];

    for (const user of users) {
      const preference = await UserAlertPreference.findOne({
        userId: user._id,
        alertId: alert._id
      });

      // Skip if user has read the alert
      if (preference?.isRead) {
        continue;
      }

      // Skip if user has snoozed and snooze is still active
      if (preference?.isCurrentlySnoozed) {
        continue;
      }

      // Skip if user is not active
      if (!user.isActive) {
        continue;
      }

      eligibleUsers.push(user);
    }

    return eligibleUsers;
  }
}

export class AnalyticsObserver implements IAlertObserver {
  public async update(alert: IAlert, users: IUser[]): Promise<void> {
    console.log(`📈 AnalyticsObserver: Recording analytics for alert "${alert.title}"`);

    try {
      // In a real implementation, this would update analytics/metrics
      // For now, we'll just log the information
      
      const analytics = {
        alertId: alert._id,
        alertTitle: alert.title,
        severity: alert.severity,
        targetUserCount: users.length,
        deliveryType: alert.deliveryType,
        timestamp: new Date(),
        visibilityType: alert.visibility.type,
        createdBy: alert.createdBy
      };

      // Store analytics data (would be in a separate analytics collection)
      console.log('📊 Analytics recorded:', analytics);

      // Could also send to external analytics services here
      // await this.sendToAnalyticsService(analytics);

    } catch (error) {
      console.error('❌ Error in AnalyticsObserver:', error);
    }
  }

  private async sendToAnalyticsService(analytics: any): Promise<void> {
    // Placeholder for external analytics integration
    // Could integrate with services like:
    // - Google Analytics
    // - Mixpanel
    // - Custom analytics API
    console.log('📡 Would send to external analytics service:', analytics);
  }
}

export class AuditObserver implements IAlertObserver {
  public async update(alert: IAlert, users: IUser[]): Promise<void> {
    console.log(`📋 AuditObserver: Creating audit log for alert "${alert.title}"`);

    try {
      const auditLog = {
        action: 'ALERT_CREATED',
        alertId: alert._id,
        alertTitle: alert.title,
        severity: alert.severity,
        targetUsers: users.map(u => ({ id: u._id, name: u.name, email: u.email })),
        targetUserCount: users.length,
        deliveryType: alert.deliveryType,
        visibilityType: alert.visibility.type,
        createdBy: alert.createdBy,
        timestamp: new Date(),
        metadata: {
          reminderEnabled: alert.isReminderEnabled,
          reminderFrequency: alert.reminderFrequencyMinutes,
          startTime: alert.startTime,
          expiryTime: alert.expiryTime
        }
      };

      // In a real implementation, this would be stored in an audit log collection
      console.log('📝 Audit log created:', auditLog);

      // Could also send to external audit systems
      // await this.sendToAuditSystem(auditLog);

    } catch (error) {
      console.error('❌ Error in AuditObserver:', error);
    }
  }

  private async sendToAuditSystem(auditLog: any): Promise<void> {
    // Placeholder for external audit system integration
    console.log('🔐 Would send to external audit system:', auditLog);
  }
}
