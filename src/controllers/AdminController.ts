import { Request, Response } from 'express';
import { AlertService } from '@/services/alerts/AlertService';
import { User, Team, Alert, UserAlertPreference, NotificationDelivery } from '@/models';
import { 
  CreateAlertRequest, 
  UpdateAlertRequest, 
  AlertFilters,
  AnalyticsResponse,
  AlertSeverity,
  AlertStatus,
  NotificationStatus
} from '@/types';
import { asyncHandler, createSuccessResponse, NotFoundError } from '@/middleware/errorHandler';
import { AuthenticatedRequest } from '@/middleware/auth';

export class AdminController {
  private alertService: AlertService;

  constructor() {
    this.alertService = new AlertService();
  }

  // Create a new alert
  public createAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const alertData: CreateAlertRequest = req.body;
    const createdBy = req.user.id;

    const alert = await this.alertService.createAlert(createdBy, alertData);

    res.status(201).json(createSuccessResponse(
      alert,
      'Alert created successfully'
    ));
  });

  // Update an existing alert
  public updateAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const updateData: UpdateAlertRequest = req.body;

    const alert = await this.alertService.updateAlert(id, updateData);

    if (!alert) {
      throw new NotFoundError('Alert');
    }

    res.json(createSuccessResponse(
      alert,
      'Alert updated successfully'
    ));
  });

  // Get all alerts with filtering
  public getAlerts = asyncHandler(async (req: Request, res: Response) => {
    const filters: AlertFilters = {
      severity: req.query.severity as AlertSeverity,
      status: req.query.status as AlertStatus,
      visibility: req.query.visibility as any,
      createdBy: req.query.createdBy as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof AlertFilters] === undefined) {
        delete filters[key as keyof AlertFilters];
      }
    });

    const alerts = await this.alertService.getAlerts(filters);

    // Add pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedAlerts = alerts.slice(startIndex, endIndex);

    res.json(createSuccessResponse(
      paginatedAlerts,
      'Alerts retrieved successfully',
      {
        total: alerts.length,
        page,
        limit,
        totalPages: Math.ceil(alerts.length / limit),
        hasNext: endIndex < alerts.length,
        hasPrev: page > 1
      }
    ));
  });

  // Get a specific alert by ID
  public getAlert = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const alert = await Alert.findById(id)
      .populate('createdBy', 'name email')
      .populate('visibility.targetIds');

    if (!alert) {
      throw new NotFoundError('Alert');
    }

    // Get delivery statistics for this alert
    const deliveryStats = await NotificationDelivery.aggregate([
      { $match: { alertId: alert._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = deliveryStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as any);

    res.json(createSuccessResponse(
      {
        alert,
        deliveryStats: stats
      },
      'Alert retrieved successfully'
    ));
  });

  // Archive an alert
  public archiveAlert = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const alert = await this.alertService.archiveAlert(id);

    if (!alert) {
      throw new NotFoundError('Alert');
    }

    res.json(createSuccessResponse(
      alert,
      'Alert archived successfully'
    ));
  });

  // Get analytics dashboard data
  public getAnalytics = asyncHandler(async (req: Request, res: Response) => {
    // Get total alerts created
    const totalAlertsCreated = await Alert.countDocuments();

    // Get alerts delivered
    const alertsDelivered = await NotificationDelivery.countDocuments({
      status: { $in: [NotificationStatus.DELIVERED, NotificationStatus.READ] }
    });

    // Get alerts read
    const alertsRead = await NotificationDelivery.countDocuments({
      status: NotificationStatus.READ
    });

    // Get snoozed count
    const snoozedCount = await NotificationDelivery.countDocuments({
      status: NotificationStatus.SNOOZED
    });

    // Get severity breakdown
    const severityBreakdown = await Alert.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    const severityStats = severityBreakdown.reduce((acc, item) => {
      acc[item._id as AlertSeverity] = item.count;
      return acc;
    }, {} as { [key in AlertSeverity]: number });

    // Ensure all severities are represented
    Object.values(AlertSeverity).forEach(severity => {
      if (!(severity in severityStats)) {
        severityStats[severity] = 0;
      }
    });

    // Get active and expired alerts count
    const activeAlertsCount = await Alert.countDocuments({
      status: AlertStatus.ACTIVE,
      isActive: true
    });

    const expiredAlertsCount = await Alert.countDocuments({
      status: AlertStatus.EXPIRED
    });

    const analytics: AnalyticsResponse = {
      totalAlertsCreated,
      alertsDelivered,
      alertsRead,
      snoozedCount,
      severityBreakdown: severityStats,
      activeAlertsCount,
      expiredAlertsCount
    };

    res.json(createSuccessResponse(
      analytics,
      'Analytics retrieved successfully'
    ));
  });

  // Get detailed analytics with time-based data
  public getDetailedAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const matchConditions: any = {};
    
    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) matchConditions.createdAt.$gte = new Date(startDate as string);
      if (endDate) matchConditions.createdAt.$lte = new Date(endDate as string);
    }

    // Time-based grouping format
    let dateFormat: string;
    switch (groupBy) {
      case 'hour':
        dateFormat = '%Y-%m-%d-%H';
        break;
      case 'week':
        dateFormat = '%Y-%U';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default: // day
        dateFormat = '%Y-%m-%d';
    }

    // Alerts created over time
    const alertsOverTime = await Alert.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          count: { $sum: 1 },
          severityBreakdown: {
            $push: '$severity'
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Delivery success rate over time
    const deliveryStats = await NotificationDelivery.aggregate([
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
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top performing alerts (by read rate)
    const topAlerts = await Alert.aggregate([
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
          readRate: 1
        }
      }
    ]);

    res.json(createSuccessResponse(
      {
        alertsOverTime,
        deliveryStats,
        topAlerts,
        timeframe: {
          startDate: startDate || 'all time',
          endDate: endDate || 'now',
          groupBy
        }
      },
      'Detailed analytics retrieved successfully'
    ));
  });

  // Manage users (admin only)
  public getUsers = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .populate('teamId', 'name')
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json(createSuccessResponse(
      users,
      'Users retrieved successfully',
      {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    ));
  });

  // Manage teams (admin only)
  public getTeams = asyncHandler(async (req: Request, res: Response) => {
    const teams = await Team.find({ isActive: true })
      .populate('memberCount')
      .sort({ name: 1 });

    res.json(createSuccessResponse(
      teams,
      'Teams retrieved successfully'
    ));
  });

  // Create team
  public createTeam = asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;

    const team = new Team({ name, description });
    await team.save();

    res.status(201).json(createSuccessResponse(
      team,
      'Team created successfully'
    ));
  });

  // Get alert delivery status for monitoring
  public getAlertDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const deliveries = await NotificationDelivery.find({ alertId: id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    const summary = {
      total: deliveries.length,
      pending: deliveries.filter(d => d.status === NotificationStatus.PENDING).length,
      delivered: deliveries.filter(d => d.status === NotificationStatus.DELIVERED).length,
      read: deliveries.filter(d => d.status === NotificationStatus.READ).length,
      snoozed: deliveries.filter(d => d.status === NotificationStatus.SNOOZED).length
    };

    res.json(createSuccessResponse(
      {
        summary,
        deliveries
      },
      'Alert delivery status retrieved successfully'
    ));
  });

  // Trigger manual reminder processing
  public triggerReminders = asyncHandler(async (req: Request, res: Response) => {
    await this.alertService.processReminders();

    res.json(createSuccessResponse(
      null,
      'Reminder processing triggered successfully'
    ));
  });
}
