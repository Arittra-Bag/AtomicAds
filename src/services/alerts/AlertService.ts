import { 
  IAlert, 
  IUser, 
  ITeam,
  CreateAlertRequest, 
  UpdateAlertRequest,
  AlertFilters,
  VisibilityType,
  AlertStatus
} from '@/types';
import { Alert, User, Team, UserAlertPreference } from '@/models';
import { AlertSubject } from './AlertSubject';
import { NotificationObserver, AnalyticsObserver, AuditObserver } from './AlertObserver';
import { NotificationStrategy } from '../notifications/NotificationStrategy';
import { AlertPreferenceStateContext } from './states/AlertStates';
import { Types } from 'mongoose';

export class AlertService {
  private alertSubject: AlertSubject;
  private notificationStrategy: NotificationStrategy;

  constructor() {
    this.notificationStrategy = new NotificationStrategy();
    this.alertSubject = new AlertSubject();

    // Register observers
    this.alertSubject.addObserver(new NotificationObserver(this.notificationStrategy));
    this.alertSubject.addObserver(new AnalyticsObserver());
    this.alertSubject.addObserver(new AuditObserver());
  }

  // Create a new alert
  public async createAlert(createdBy: string, alertData: CreateAlertRequest): Promise<IAlert> {
    try {
      // Validate visibility targets
      await this.validateVisibilityTargets(alertData.visibility);

      // Create the alert
      const alert = new Alert({
        ...alertData,
        createdBy: new Types.ObjectId(createdBy),
        visibility: {
          type: alertData.visibility.type,
          targetIds: alertData.visibility.targetIds.map(id => new Types.ObjectId(id))
        }
      });

      await alert.save();
      console.log(`✅ Alert created: ${alert.title} by user ${createdBy}`);

      // Get target users and notify observers
      const targetUsers = await this.getTargetUsers(alert);
      await this.alertSubject.notifyObserversWithContext(
        alert, 
        targetUsers, 
        { action: 'created' }
      );

      return alert;
    } catch (error) {
      console.error('❌ Error creating alert:', error);
      throw error;
    }
  }

  // Update an existing alert
  public async updateAlert(alertId: string, updateData: UpdateAlertRequest): Promise<IAlert | null> {
    try {
      const alert = await Alert.findById(alertId);
      
      if (!alert) {
        throw new Error('Alert not found');
      }

      // Validate visibility targets if visibility is being updated
      if (updateData.visibility) {
        await this.validateVisibilityTargets(updateData.visibility);
        (updateData.visibility as any).targetIds = updateData.visibility.targetIds?.map(id => new Types.ObjectId(id));
      }

      // Update the alert
      Object.assign(alert, updateData);
      await alert.save();

      console.log(`✅ Alert updated: ${alert.title}`);

      // Get target users and notify observers
      const targetUsers = await this.getTargetUsers(alert);
      await this.alertSubject.notifyObserversWithContext(
        alert, 
        targetUsers, 
        { action: 'updated', metadata: updateData }
      );

      return alert;
    } catch (error) {
      console.error('❌ Error updating alert:', error);
      throw error;
    }
  }

  // Get alerts with filtering
  public async getAlerts(filters: AlertFilters = {}): Promise<IAlert[]> {
    try {
      const query: any = {};

      // Apply filters
      if (filters.severity) {
        query.severity = filters.severity;
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.visibility) {
        query['visibility.type'] = filters.visibility;
      }

      if (filters.createdBy) {
        query.createdBy = new Types.ObjectId(filters.createdBy);
      }

      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) {
          query.createdAt.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.createdAt.$lte = filters.endDate;
        }
      }

      const alerts = await Alert.find(query)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });

      return alerts;
    } catch (error) {
      console.error('❌ Error getting alerts:', error);
      throw error;
    }
  }

  // Get alerts for a specific user
  public async getAlertsForUser(userId: string): Promise<any[]> {
    try {
      const user = await User.findById(userId).populate('teamId');
      
      if (!user) {
        throw new Error('User not found');
      }

      // Find alerts based on visibility
      const alerts = await (Alert as any).findForUser(userId, user.teamId?.toString());

      // Get user preferences for these alerts
      const alertsWithPreferences = await Promise.all(
        alerts.map(async (alert: any) => {
          let preference = await UserAlertPreference.findOne({
            userId: new Types.ObjectId(userId),
            alertId: alert._id
          });

          // Create preference if it doesn't exist
          if (!preference) {
            preference = new UserAlertPreference({
              userId: new Types.ObjectId(userId),
              alertId: alert._id,
              isRead: false,
              isSnoozed: false,
              reminderCount: 0
            });
            await preference.save();
          }

          // Process automatic state transitions
          AlertPreferenceStateContext.processAutomaticTransitions(preference);
          if (preference.isModified()) {
            await preference.save();
          }

          return {
            alert: alert.toObject(),
            preference: preference.toObject(),
            state: AlertPreferenceStateContext.getStateName(preference),
            availableActions: AlertPreferenceStateContext.getAvailableActions(preference)
          };
        })
      );

      return alertsWithPreferences;
    } catch (error) {
      console.error('❌ Error getting alerts for user:', error);
      throw error;
    }
  }

  // Archive an alert
  public async archiveAlert(alertId: string): Promise<IAlert | null> {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        { 
          status: AlertStatus.ARCHIVED,
          isActive: false
        },
        { new: true }
      );

      if (alert) {
        console.log(`📁 Alert archived: ${alert.title}`);
      }

      return alert;
    } catch (error) {
      console.error('❌ Error archiving alert:', error);
      throw error;
    }
  }

  // Mark alert as read for a user
  public async markAlertAsRead(userId: string, alertId: string): Promise<boolean> {
    try {
      const preference = await UserAlertPreference.findOne({
        userId: new Types.ObjectId(userId),
        alertId: new Types.ObjectId(alertId)
      });

      if (!preference) {
        throw new Error('Alert preference not found');
      }

      AlertPreferenceStateContext.markAsRead(preference);
      await preference.save();

      console.log(`✅ Alert marked as read for user ${userId}: ${alertId}`);
      return true;
    } catch (error) {
      console.error('❌ Error marking alert as read:', error);
      throw error;
    }
  }

  // Snooze alert for a user
  public async snoozeAlert(userId: string, alertId: string, hours: number = 24): Promise<boolean> {
    try {
      const preference = await UserAlertPreference.findOne({
        userId: new Types.ObjectId(userId),
        alertId: new Types.ObjectId(alertId)
      });

      if (!preference) {
        throw new Error('Alert preference not found');
      }

      AlertPreferenceStateContext.snooze(preference, hours);
      await preference.save();

      console.log(`😴 Alert snoozed for ${hours}h for user ${userId}: ${alertId}`);
      return true;
    } catch (error) {
      console.error('❌ Error snoozing alert:', error);
      throw error;
    }
  }

  // Unsnooze alert for a user
  public async unsnoozeAlert(userId: string, alertId: string): Promise<boolean> {
    try {
      const preference = await UserAlertPreference.findOne({
        userId: new Types.ObjectId(userId),
        alertId: new Types.ObjectId(alertId)
      });

      if (!preference) {
        throw new Error('Alert preference not found');
      }

      AlertPreferenceStateContext.unsnooze(preference);
      await preference.save();

      console.log(`⏰ Alert unsnoozed for user ${userId}: ${alertId}`);
      return true;
    } catch (error) {
      console.error('❌ Error unsnoozing alert:', error);
      throw error;
    }
  }

  // Process reminders for active alerts
  public async processReminders(): Promise<void> {
    try {
      console.log('🔄 Processing alert reminders...');

      // Get all active alerts with reminders enabled
      const activeAlerts = await Alert.find({
        isActive: true,
        status: AlertStatus.ACTIVE,
        isReminderEnabled: true,
        startTime: { $lte: new Date() },
        $or: [
          { expiryTime: { $exists: false } },
          { expiryTime: { $gt: new Date() } }
        ]
      });

      console.log(`📋 Found ${activeAlerts.length} active alerts with reminders enabled`);

      for (const alert of activeAlerts) {
        await this.processReminderForAlert(alert);
      }

      console.log('✅ Reminder processing completed');
    } catch (error) {
      console.error('❌ Error processing reminders:', error);
    }
  }

  private async processReminderForAlert(alert: IAlert): Promise<void> {
    try {
      // Find users who need reminders for this alert
      const preferencesNeedingReminder = await (UserAlertPreference as any).findUsersNeedingReminder(
        alert._id.toString(),
        alert.reminderFrequencyMinutes
      );

      if (preferencesNeedingReminder.length === 0) {
        return;
      }

      console.log(`⏰ Sending reminders for alert "${alert.title}" to ${preferencesNeedingReminder.length} users`);

      // Send reminders and update preferences
      const reminderPromises = preferencesNeedingReminder.map(async (preference: any) => {
        const user = preference.userId as any; // Populated user
        
        // Check if user can receive reminder based on current state
        if (AlertPreferenceStateContext.canReceiveReminder(preference)) {
          // Send reminder notification
          const success = await this.notificationStrategy.sendNotification(
            alert,
            user,
            alert.deliveryType
          );

          if (success) {
            // Record reminder sent
            preference.recordReminderSent();
            await preference.save();
            console.log(`📤 Reminder sent to ${user.name} for alert: ${alert.title}`);
          }
        }
      });

      await Promise.all(reminderPromises);

      // Notify observers about reminders
      const targetUsers = preferencesNeedingReminder.map((p: any) => p.userId as any);
      await this.alertSubject.notifyObserversWithContext(
        alert,
        targetUsers,
        { action: 'reminder', metadata: { reminderCount: preferencesNeedingReminder.length } }
      );

    } catch (error) {
      console.error(`❌ Error processing reminder for alert ${alert.title}:`, error);
    }
  }

  private async validateVisibilityTargets(visibility: { type: VisibilityType; targetIds: string[] }): Promise<void> {
    if (visibility.type === VisibilityType.ORGANIZATION) {
      // For organization-wide, we don't need specific target validation
      return;
    }

    if (visibility.type === VisibilityType.TEAM) {
      // Validate team IDs exist
      const teams = await Team.find({ _id: { $in: visibility.targetIds } });
      if (teams.length !== visibility.targetIds.length) {
        throw new Error('One or more team IDs are invalid');
      }
    }

    if (visibility.type === VisibilityType.USER) {
      // Validate user IDs exist
      const users = await User.find({ _id: { $in: visibility.targetIds } });
      if (users.length !== visibility.targetIds.length) {
        throw new Error('One or more user IDs are invalid');
      }
    }
  }

  private async getTargetUsers(alert: IAlert): Promise<IUser[]> {
    const targetUsers: IUser[] = [];

    switch (alert.visibility.type) {
      case VisibilityType.ORGANIZATION:
        // Get all active users
        const allUsers = await User.find({ isActive: true });
        targetUsers.push(...allUsers);
        break;

      case VisibilityType.TEAM:
        // Get users from specified teams
        for (const teamId of alert.visibility.targetIds) {
          const teamUsers = await User.find({ teamId, isActive: true });
          targetUsers.push(...teamUsers);
        }
        break;

      case VisibilityType.USER:
        // Get specified users
        const specificUsers = await User.find({ 
          _id: { $in: alert.visibility.targetIds },
          isActive: true 
        });
        targetUsers.push(...specificUsers);
        break;
    }

    // Remove duplicates
    const uniqueUsers = targetUsers.filter((user, index, self) => 
      self.findIndex(u => u._id.toString() === user._id.toString()) === index
    );

    return uniqueUsers;
  }

  // Get notification strategy (for external access if needed)
  public getNotificationStrategy(): NotificationStrategy {
    return this.notificationStrategy;
  }

  // Get alert subject (for external access if needed)
  public getAlertSubject(): AlertSubject {
    return this.alertSubject;
  }
}
