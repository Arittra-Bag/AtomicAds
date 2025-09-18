import { Request, Response } from 'express';
import { AlertService } from '@/services/alerts/AlertService';
import { User, UserAlertPreference } from '@/models';
import { asyncHandler, createSuccessResponse, NotFoundError } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';
import { InAppNotificationChannel } from '@/services/notifications/channels';

export class UserController {
  private alertService: AlertService;
  private inAppChannel: InAppNotificationChannel;

  constructor() {
    this.alertService = new AlertService();
    this.inAppChannel = new InAppNotificationChannel();
  }

  // Get user's alerts
  public getMyAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string; // 'read', 'unread', 'snoozed'
    const severity = req.query.severity as string;

    const alerts = await this.alertService.getAlertsForUser(userId);

    // Apply filters
    let filteredAlerts = alerts;

    if (status) {
      filteredAlerts = alerts.filter(alertData => {
        const preference = alertData.preference;
        switch (status) {
          case 'read':
            return preference.isRead;
          case 'unread':
            return !preference.isRead && !preference.isSnoozed;
          case 'snoozed':
            return preference.isSnoozed && 
                   preference.snoozedUntil && 
                   new Date(preference.snoozedUntil) > new Date();
          default:
            return true;
        }
      });
    }

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alertData => 
        alertData.alert.severity === severity
      );
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

    // Get counts for different statuses
    const counts = {
      total: alerts.length,
      unread: alerts.filter(a => !a.preference.isRead && !a.preference.isSnoozed).length,
      read: alerts.filter(a => a.preference.isRead).length,
      snoozed: alerts.filter(a => 
        a.preference.isSnoozed && 
        a.preference.snoozedUntil && 
        new Date(a.preference.snoozedUntil) > new Date()
      ).length
    };

    res.json(createSuccessResponse(
      paginatedAlerts,
      'User alerts retrieved successfully',
      {
        counts,
        pagination: {
          total: filteredAlerts.length,
          page,
          limit,
          totalPages: Math.ceil(filteredAlerts.length / limit),
          hasNext: endIndex < filteredAlerts.length,
          hasPrev: page > 1
        }
      }
    ));
  });

  // Get user's in-app notifications
  public getMyNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const notifications = await this.inAppChannel.getUserNotifications(userId, limit);

    res.json(createSuccessResponse(
      notifications,
      'User notifications retrieved successfully'
    ));
  });

  // Mark alert as read
  public markAlertAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { alertId } = req.params;

    const success = await this.alertService.markAlertAsRead(userId, alertId);

    if (!success) {
      throw new NotFoundError('Alert or user preference');
    }

    // Also mark in-app notification as read
    await this.inAppChannel.markAsRead(alertId, userId);

    res.json(createSuccessResponse(
      null,
      'Alert marked as read successfully'
    ));
  });

  // Mark alert as unread
  public markAlertAsUnread = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { alertId } = req.params;

    const preference = await UserAlertPreference.findOne({
      userId,
      alertId
    });

    if (!preference) {
      throw new NotFoundError('Alert preference');
    }

    preference.isRead = false;
    await preference.save();

    res.json(createSuccessResponse(
      null,
      'Alert marked as unread successfully'
    ));
  });

  // Snooze alert
  public snoozeAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { alertId } = req.params;
    const { hours = 24 } = req.body;

    const success = await this.alertService.snoozeAlert(userId, alertId, hours);

    if (!success) {
      throw new NotFoundError('Alert or user preference');
    }

    // Also snooze in-app notification
    await this.inAppChannel.snooze(alertId, userId, hours);

    res.json(createSuccessResponse(
      null,
      `Alert snoozed for ${hours} hours successfully`
    ));
  });

  // Unsnooze alert
  public unsnoozeAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { alertId } = req.params;

    const success = await this.alertService.unsnoozeAlert(userId, alertId);

    if (!success) {
      throw new NotFoundError('Alert or user preference');
    }

    res.json(createSuccessResponse(
      null,
      'Alert unsnoozed successfully'
    ));
  });

  // Get user's alert statistics
  public getMyAlertStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;

    const stats = await UserAlertPreference.aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: 'alerts',
          localField: 'alertId',
          foreignField: '_id',
          as: 'alert'
        }
      },
      { $unwind: '$alert' },
      {
        $group: {
          _id: null,
          totalAlerts: { $sum: 1 },
          readAlerts: { $sum: { $cond: ['$isRead', 1, 0] } },
          snoozedAlerts: { $sum: { $cond: ['$isSnoozed', 1, 0] } },
          criticalAlerts: {
            $sum: { $cond: [{ $eq: ['$alert.severity', 'Critical'] }, 1, 0] }
          },
          warningAlerts: {
            $sum: { $cond: [{ $eq: ['$alert.severity', 'Warning'] }, 1, 0] }
          },
          infoAlerts: {
            $sum: { $cond: [{ $eq: ['$alert.severity', 'Info'] }, 1, 0] }
          },
          totalReminders: { $sum: '$reminderCount' }
        }
      }
    ]);

    const userStats = stats[0] || {
      totalAlerts: 0,
      readAlerts: 0,
      snoozedAlerts: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      infoAlerts: 0,
      totalReminders: 0
    };

    // Calculate additional metrics
    const readRate = userStats.totalAlerts > 0 
      ? (userStats.readAlerts / userStats.totalAlerts * 100).toFixed(1)
      : '0';

    const unreadAlerts = userStats.totalAlerts - userStats.readAlerts;

    res.json(createSuccessResponse(
      {
        ...userStats,
        unreadAlerts,
        readRate: parseFloat(readRate)
      },
      'User alert statistics retrieved successfully'
    ));
  });

  // Get user profile
  public getMyProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .select('-password')
      .populate('teamId', 'name description');

    if (!user) {
      throw new NotFoundError('User');
    }

    res.json(createSuccessResponse(
      user,
      'User profile retrieved successfully'
    ));
  });

  // Update user profile
  public updateMyProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { name } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { name },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      throw new NotFoundError('User');
    }

    res.json(createSuccessResponse(
      user,
      'Profile updated successfully'
    ));
  });

  // Get snoozed alerts history
  public getSnoozedAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const snoozedPreferences = await UserAlertPreference.find({
      userId,
      isSnoozed: true
    })
    .populate('alertId')
    .sort({ snoozedUntil: -1 })
    .limit(limit)
    .skip((page - 1) * limit);

    const total = await UserAlertPreference.countDocuments({
      userId,
      isSnoozed: true
    });

    // Separate active snoozes from expired ones
    const now = new Date();
    const activeSnoozes = snoozedPreferences.filter(p => 
      p.snoozedUntil && p.snoozedUntil > now
    );
    const expiredSnoozes = snoozedPreferences.filter(p => 
      !p.snoozedUntil || p.snoozedUntil <= now
    );

    res.json(createSuccessResponse(
      {
        activeSnoozes,
        expiredSnoozes,
        summary: {
          active: activeSnoozes.length,
          expired: expiredSnoozes.length,
          total: snoozedPreferences.length
        }
      },
      'Snoozed alerts retrieved successfully',
      {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    ));
  });

  // Bulk mark alerts as read
  public bulkMarkAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { alertIds } = req.body;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      throw new Error('alertIds array is required');
    }

    const updateResults = await Promise.all(
      alertIds.map(alertId => this.alertService.markAlertAsRead(userId, alertId))
    );

    const successCount = updateResults.filter(Boolean).length;
    const failureCount = alertIds.length - successCount;

    res.json(createSuccessResponse(
      {
        total: alertIds.length,
        successful: successCount,
        failed: failureCount
      },
      `Bulk update completed: ${successCount} alerts marked as read`
    ));
  });

  // Bulk snooze alerts
  public bulkSnoozeAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { alertIds, hours = 24 } = req.body;

    if (!Array.isArray(alertIds) || alertIds.length === 0) {
      throw new Error('alertIds array is required');
    }

    const updateResults = await Promise.all(
      alertIds.map(alertId => this.alertService.snoozeAlert(userId, alertId, hours))
    );

    const successCount = updateResults.filter(Boolean).length;
    const failureCount = alertIds.length - successCount;

    res.json(createSuccessResponse(
      {
        total: alertIds.length,
        successful: successCount,
        failed: failureCount,
        snoozeHours: hours
      },
      `Bulk snooze completed: ${successCount} alerts snoozed for ${hours} hours`
    ));
  });
}
