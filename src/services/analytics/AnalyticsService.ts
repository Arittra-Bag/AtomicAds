import { Alert, NotificationDelivery, UserAlertPreference, User, Team } from '@/models';
import { AlertSeverity, AlertStatus, NotificationStatus, AnalyticsResponse } from '@/types';

export class AnalyticsService {
  // Get basic analytics dashboard data
  public async getBasicAnalytics(): Promise<AnalyticsResponse> {
    const [
      totalAlertsCreated,
      alertsDelivered,
      alertsRead,
      snoozedCount,
      severityBreakdown,
      activeAlertsCount,
      expiredAlertsCount
    ] = await Promise.all([
      Alert.countDocuments(),
      NotificationDelivery.countDocuments({
        status: { $in: [NotificationStatus.DELIVERED, NotificationStatus.READ] }
      }),
      NotificationDelivery.countDocuments({
        status: NotificationStatus.READ
      }),
      NotificationDelivery.countDocuments({
        status: NotificationStatus.SNOOZED
      }),
      this.getSeverityBreakdown(),
      Alert.countDocuments({
        status: AlertStatus.ACTIVE,
        isActive: true
      }),
      Alert.countDocuments({
        status: AlertStatus.EXPIRED
      })
    ]);

    return {
      totalAlertsCreated,
      alertsDelivered,
      alertsRead,
      snoozedCount,
      severityBreakdown,
      activeAlertsCount,
      expiredAlertsCount
    };
  }

  // Get severity breakdown
  private async getSeverityBreakdown(): Promise<{ [key in AlertSeverity]: number }> {
    const breakdown = await Alert.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    const result = {} as { [key in AlertSeverity]: number };
    
    // Initialize all severities with 0
    Object.values(AlertSeverity).forEach(severity => {
      result[severity] = 0;
    });

    // Fill in actual counts
    breakdown.forEach(item => {
      if (Object.values(AlertSeverity).includes(item._id)) {
        result[item._id as AlertSeverity] = item.count;
      }
    });

    return result;
  }

  // Get detailed analytics with time-based data
  public async getDetailedAnalytics(filters: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
  }) {
    const { startDate, endDate, groupBy = 'day' } = filters;

    const matchConditions: any = {};
    
    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) matchConditions.createdAt.$gte = startDate;
      if (endDate) matchConditions.createdAt.$lte = endDate;
    }

    const dateFormat = this.getDateFormat(groupBy);

    const [alertsOverTime, deliveryStats, topAlerts] = await Promise.all([
      this.getAlertsOverTime(matchConditions, dateFormat),
      this.getDeliveryStats(matchConditions, dateFormat),
      this.getTopPerformingAlerts(matchConditions)
    ]);

    return {
      alertsOverTime,
      deliveryStats,
      topAlerts,
      timeframe: {
        startDate: startDate || 'all time',
        endDate: endDate || 'now',
        groupBy
      }
    };
  }

  private getDateFormat(groupBy: string): string {
    switch (groupBy) {
      case 'hour':
        return '%Y-%m-%d-%H';
      case 'week':
        return '%Y-%U';
      case 'month':
        return '%Y-%m';
      default: // day
        return '%Y-%m-%d';
    }
  }

  private async getAlertsOverTime(matchConditions: any, dateFormat: string) {
    return Alert.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          count: { $sum: 1 },
          criticalCount: {
            $sum: { $cond: [{ $eq: ['$severity', AlertSeverity.CRITICAL] }, 1, 0] }
          },
          warningCount: {
            $sum: { $cond: [{ $eq: ['$severity', AlertSeverity.WARNING] }, 1, 0] }
          },
          infoCount: {
            $sum: { $cond: [{ $eq: ['$severity', AlertSeverity.INFO] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  private async getDeliveryStats(matchConditions: any, dateFormat: string) {
    return NotificationDelivery.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          total: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [
                { $in: ['$status', [NotificationStatus.DELIVERED, NotificationStatus.READ]] },
                1,
                0
              ]
            }
          },
          read: {
            $sum: {
              $cond: [{ $eq: ['$status', NotificationStatus.READ] }, 1, 0]
            }
          },
          snoozed: {
            $sum: {
              $cond: [{ $eq: ['$status', NotificationStatus.SNOOZED] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          deliveryRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $divide: ['$delivered', '$total'] },
              0
            ]
          },
          readRate: {
            $cond: [
              { $gt: ['$delivered', 0] },
              { $divide: ['$read', '$delivered'] },
              0
            ]
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  private async getTopPerformingAlerts(matchConditions: any) {
    return Alert.aggregate([
      { $match: matchConditions },
      {
        $lookup: {
          from: 'notificationdeliveries',
          localField: '_id',
          foreignField: 'alertId',
          as: 'deliveries'
        }
      },
      {
        $addFields: {
          totalDeliveries: { $size: '$deliveries' },
          readCount: {
            $size: {
              $filter: {
                input: '$deliveries',
                cond: { $eq: ['$$this.status', NotificationStatus.READ] }
              }
            }
          }
        }
      },
      {
        $addFields: {
          readRate: {
            $cond: [
              { $gt: ['$totalDeliveries', 0] },
              { $divide: ['$readCount', '$totalDeliveries'] },
              0
            ]
          }
        }
      },
      { $sort: { readRate: -1 } },
      { $limit: 10 },
      {
        $project: {
          title: 1,
          severity: 1,
          createdAt: 1,
          totalDeliveries: 1,
          readCount: 1,
          readRate: 1,
          visibility: 1
        }
      }
    ]);
  }

  // Get user engagement analytics
  public async getUserEngagementAnalytics() {
    const [
      totalUsers,
      activeUsers,
      userReadRates,
      teamEngagement
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      this.getActiveUsers(),
      this.getUserReadRates(),
      this.getTeamEngagement()
    ]);

    return {
      totalUsers,
      activeUsers,
      userReadRates,
      teamEngagement
    };
  }

  private async getActiveUsers() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    return UserAlertPreference.aggregate([
      {
        $match: {
          updatedAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$userId'
        }
      },
      {
        $count: 'activeUsers'
      }
    ]).then(result => result[0]?.activeUsers || 0);
  }

  private async getUserReadRates() {
    return UserAlertPreference.aggregate([
      {
        $group: {
          _id: '$userId',
          totalAlerts: { $sum: 1 },
          readAlerts: { $sum: { $cond: ['$isRead', 1, 0] } }
        }
      },
      {
        $addFields: {
          readRate: {
            $cond: [
              { $gt: ['$totalAlerts', 0] },
              { $divide: ['$readAlerts', '$totalAlerts'] },
              0
            ]
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userName: '$user.name',
          userEmail: '$user.email',
          totalAlerts: 1,
          readAlerts: 1,
          readRate: 1
        }
      },
      { $sort: { readRate: -1 } },
      { $limit: 20 }
    ]);
  }

  private async getTeamEngagement() {
    return Team.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'teamId',
          as: 'members'
        }
      },
      {
        $unwind: {
          path: '$members',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'useralertpreferences',
          localField: 'members._id',
          foreignField: 'userId',
          as: 'preferences'
        }
      },
      {
        $group: {
          _id: '$_id',
          teamName: { $first: '$name' },
          memberCount: { $sum: { $cond: ['$members', 1, 0] } },
          totalAlerts: { $sum: { $size: '$preferences' } },
          readAlerts: {
            $sum: {
              $size: {
                $filter: {
                  input: '$preferences',
                  cond: { $eq: ['$$this.isRead', true] }
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          readRate: {
            $cond: [
              { $gt: ['$totalAlerts', 0] },
              { $divide: ['$readAlerts', '$totalAlerts'] },
              0
            ]
          },
          averageAlertsPerMember: {
            $cond: [
              { $gt: ['$memberCount', 0] },
              { $divide: ['$totalAlerts', '$memberCount'] },
              0
            ]
          }
        }
      },
      { $sort: { readRate: -1 } }
    ]);
  }

  // Get alert delivery performance metrics
  public async getDeliveryPerformance() {
    const [
      overallDeliveryRate,
      deliveryByChannel,
      averageDeliveryTime,
      failureAnalysis
    ] = await Promise.all([
      this.getOverallDeliveryRate(),
      this.getDeliveryByChannel(),
      this.getAverageDeliveryTime(),
      this.getFailureAnalysis()
    ]);

    return {
      overallDeliveryRate,
      deliveryByChannel,
      averageDeliveryTime,
      failureAnalysis
    };
  }

  private async getOverallDeliveryRate() {
    const total = await NotificationDelivery.countDocuments();
    const successful = await NotificationDelivery.countDocuments({
      status: { $in: [NotificationStatus.DELIVERED, NotificationStatus.READ] }
    });

    return {
      total,
      successful,
      rate: total > 0 ? (successful / total) * 100 : 0
    };
  }

  private async getDeliveryByChannel() {
    return NotificationDelivery.aggregate([
      {
        $group: {
          _id: '$deliveryType',
          total: { $sum: 1 },
          successful: {
            $sum: {
              $cond: [
                { $in: ['$status', [NotificationStatus.DELIVERED, NotificationStatus.READ]] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          successRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $divide: ['$successful', '$total'] },
              0
            ]
          }
        }
      }
    ]);
  }

  private async getAverageDeliveryTime() {
    return NotificationDelivery.aggregate([
      {
        $match: {
          deliveredAt: { $exists: true },
          createdAt: { $exists: true }
        }
      },
      {
        $addFields: {
          deliveryTimeMs: {
            $subtract: ['$deliveredAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          averageDeliveryTimeMs: { $avg: '$deliveryTimeMs' },
          minDeliveryTimeMs: { $min: '$deliveryTimeMs' },
          maxDeliveryTimeMs: { $max: '$deliveryTimeMs' }
        }
      }
    ]).then(result => result[0] || {
      averageDeliveryTimeMs: 0,
      minDeliveryTimeMs: 0,
      maxDeliveryTimeMs: 0
    });
  }

  private async getFailureAnalysis() {
    return NotificationDelivery.aggregate([
      {
        $match: {
          status: NotificationStatus.PENDING
        }
      },
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
          _id: {
            severity: '$alert.severity',
            deliveryType: '$deliveryType'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          severity: '$_id.severity',
          deliveryType: '$_id.deliveryType',
          failureCount: '$count',
          _id: 0
        }
      }
    ]);
  }

  // Get real-time dashboard metrics
  public async getRealTimeMetrics() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      alertsLastHour,
      alertsLast24Hours,
      pendingDeliveries,
      activeSnoozes,
      criticalAlerts
    ] = await Promise.all([
      Alert.countDocuments({ createdAt: { $gte: lastHour } }),
      Alert.countDocuments({ createdAt: { $gte: last24Hours } }),
      NotificationDelivery.countDocuments({ status: NotificationStatus.PENDING }),
      UserAlertPreference.countDocuments({
        isSnoozed: true,
        snoozedUntil: { $gt: now }
      }),
      Alert.countDocuments({
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.ACTIVE,
        isActive: true
      })
    ]);

    return {
      alertsLastHour,
      alertsLast24Hours,
      pendingDeliveries,
      activeSnoozes,
      criticalAlerts,
      timestamp: now
    };
  }

  // Get per-alert analytics with recurring vs snoozed insights
  public async getPerAlertAnalytics() {
    const alerts = await Alert.aggregate([
      {
        $match: {
          status: { $ne: AlertStatus.ARCHIVED }
        }
      },
      {
        $lookup: {
          from: 'useralertpreferences',
          localField: '_id',
          foreignField: 'alertId',
          as: 'preferences'
        }
      },
      {
        $lookup: {
          from: 'notificationdeliveries',
          localField: '_id',
          foreignField: 'alertId',
          as: 'deliveries'
        }
      },
      {
        $addFields: {
          totalRecipients: { $size: '$preferences' },
          readCount: {
            $size: {
              $filter: {
                input: '$preferences',
                cond: { $eq: ['$$this.isRead', true] }
              }
            }
          },
          snoozedCount: {
            $size: {
              $filter: {
                input: '$preferences',
                cond: { $eq: ['$$this.isSnoozed', true] }
              }
            }
          },
          currentlySnoozedCount: {
            $size: {
              $filter: {
                input: '$preferences',
                cond: {
                  $and: [
                    { $eq: ['$$this.isSnoozed', true] },
                    { $gt: ['$$this.snoozedUntil', new Date()] }
                  ]
                }
              }
            }
          },
          deliveredCount: { $size: '$deliveries' },
          totalReminders: {
            $sum: '$preferences.reminderCount'
          }
        }
      },
      {
        $addFields: {
          readRate: {
            $cond: [
              { $gt: ['$totalRecipients', 0] },
              { $multiply: [{ $divide: ['$readCount', '$totalRecipients'] }, 100] },
              0
            ]
          },
          snoozedRate: {
            $cond: [
              { $gt: ['$totalRecipients', 0] },
              { $multiply: [{ $divide: ['$snoozedCount', '$totalRecipients'] }, 100] },
              0
            ]
          },
          currentSnoozedRate: {
            $cond: [
              { $gt: ['$totalRecipients', 0] },
              { $multiply: [{ $divide: ['$currentlySnoozedCount', '$totalRecipients'] }, 100] },
              0
            ]
          },
          engagementStatus: {
            $switch: {
              branches: [
                {
                  case: { $gte: ['$snoozedRate', 70] },
                  then: 'mostly_snoozed'
                },
                {
                  case: { $gte: ['$readRate', 80] },
                  then: 'highly_engaged'
                },
                {
                  case: { $and: [{ $gte: ['$readRate', 40] }, { $lt: ['$snoozedRate', 30] }] },
                  then: 'moderately_engaged'
                },
                {
                  case: { $and: [{ $lt: ['$readRate', 40] }, { $lt: ['$snoozedRate', 30] }] },
                  then: 'low_engagement'
                }
              ],
              default: 'mixed_engagement'
            }
          },
          recurringCandidates: {
            $subtract: ['$totalRecipients', '$currentlySnoozedCount']
          }
        }
      },
      {
        $project: {
          _id: 1,
          title: 1,
          severity: 1,
          status: 1,
          createdAt: 1,
          startTime: 1,
          expiryTime: 1,
          visibility: 1,
          totalRecipients: 1,
          deliveredCount: 1,
          readCount: 1,
          snoozedCount: 1,
          currentlySnoozedCount: 1,
          recurringCandidates: 1,
          totalReminders: 1,
          readRate: { $round: ['$readRate', 1] },
          snoozedRate: { $round: ['$snoozedRate', 1] },
          currentSnoozedRate: { $round: ['$currentSnoozedRate', 1] },
          engagementStatus: 1,
          isCurrentlyActive: {
            $and: [
              { $lte: ['$startTime', new Date()] },
              { $gt: ['$expiryTime', new Date()] },
              { $eq: ['$isActive', true] }
            ]
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    // Group by engagement status for summary
    const summary = {
      total: alerts.length,
      highly_engaged: alerts.filter(a => a.engagementStatus === 'highly_engaged').length,
      moderately_engaged: alerts.filter(a => a.engagementStatus === 'moderately_engaged').length,
      low_engagement: alerts.filter(a => a.engagementStatus === 'low_engagement').length,
      mostly_snoozed: alerts.filter(a => a.engagementStatus === 'mostly_snoozed').length,
      mixed_engagement: alerts.filter(a => a.engagementStatus === 'mixed_engagement').length,
      active_alerts: alerts.filter(a => a.isCurrentlyActive).length,
      total_recurring_candidates: alerts.reduce((sum, a) => sum + a.recurringCandidates, 0)
    };

    return {
      alerts,
      summary,
      insights: {
        most_snoozed: alerts
          .filter(a => a.snoozedRate > 50)
          .sort((a, b) => b.snoozedRate - a.snoozedRate)
          .slice(0, 5),
        highest_engagement: alerts
          .filter(a => a.readRate > 50)
          .sort((a, b) => b.readRate - a.readRate)
          .slice(0, 5),
        most_reminders: alerts
          .sort((a, b) => b.totalReminders - a.totalReminders)
          .slice(0, 5)
      }
    };
  }
}
