import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError, AlertSeverity, DeliveryType, VisibilityType } from '@/types';

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      next(new AppError(`Validation error: ${errorMessages.join(', ')}`, 400));
      return;
    }
    
    next();
  };
};

// Query validation middleware
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      next(new AppError(`Query validation error: ${errorMessages.join(', ')}`, 400));
      return;
    }
    
    next();
  };
};

// Params validation middleware
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params, { 
      abortEarly: false,
      stripUnknown: true 
    });
    
    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      next(new AppError(`Parameter validation error: ${errorMessages.join(', ')}`, 400));
      return;
    }
    
    next();
  };
};

// Common validation schemas
export const schemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required()
    .messages({
      'string.pattern.base': 'Invalid ObjectId format'
    }),

  // Optional ObjectId
  optionalObjectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional()
    .messages({
      'string.pattern.base': 'Invalid ObjectId format'
    }),

  // User registration/creation
  createUser: Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 100 characters'
      }),
    email: Joi.string().email().trim().lowercase().required()
      .messages({
        'string.email': 'Please provide a valid email address'
      }),
    password: Joi.string().min(6).max(128).required()
      .messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.max': 'Password cannot exceed 128 characters'
      }),
    role: Joi.string().valid('admin', 'user').default('user'),
    teamId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional()
      .messages({
        'string.pattern.base': 'Invalid team ID format'
      })
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().trim().lowercase().required(),
    password: Joi.string().required()
  }),

  // Team creation
  createTeam: Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().trim().max(500).optional()
  }),

  // Alert creation
  createAlert: Joi.object({
    title: Joi.string().trim().min(3).max(200).required()
      .messages({
        'string.min': 'Title must be at least 3 characters long',
        'string.max': 'Title cannot exceed 200 characters'
      }),
    message: Joi.string().trim().min(10).max(2000).required()
      .messages({
        'string.min': 'Message must be at least 10 characters long',
        'string.max': 'Message cannot exceed 2000 characters'
      }),
    severity: Joi.string().valid(...Object.values(AlertSeverity)).required(),
    deliveryType: Joi.string().valid(...Object.values(DeliveryType)).default(DeliveryType.IN_APP),
    reminderFrequencyMinutes: Joi.number().integer().min(1).max(10080).default(120), // 1 minute to 1 week
    startTime: Joi.date().iso().default(() => new Date()),
    expiryTime: Joi.date().iso().greater(Joi.ref('startTime')).optional()
      .messages({
        'date.greater': 'Expiry time must be after start time'
      }),
    isReminderEnabled: Joi.boolean().default(true),
    visibility: Joi.object({
      type: Joi.string().valid(...Object.values(VisibilityType)).required(),
      targetIds: Joi.array().items(
        Joi.string().regex(/^[0-9a-fA-F]{24}$/)
          .messages({
            'string.pattern.base': 'Invalid target ID format'
          })
      ).min(0).required()
        .when('type', {
          is: VisibilityType.ORGANIZATION,
          then: Joi.array().length(0), // Organization doesn't need target IDs
          otherwise: Joi.array().min(1) // Team and User need at least one target ID
        })
    }).required()
  }),

  // Alert update
  updateAlert: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    message: Joi.string().trim().min(10).max(2000).optional(),
    severity: Joi.string().valid(...Object.values(AlertSeverity)).optional(),
    deliveryType: Joi.string().valid(...Object.values(DeliveryType)).optional(),
    reminderFrequencyMinutes: Joi.number().integer().min(1).max(10080).optional(),
    startTime: Joi.date().iso().optional(),
    expiryTime: Joi.date().iso().optional(),
    isActive: Joi.boolean().optional(),
    isReminderEnabled: Joi.boolean().optional(),
    visibility: Joi.object({
      type: Joi.string().valid(...Object.values(VisibilityType)).required(),
      targetIds: Joi.array().items(
        Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      ).min(0).required()
        .when('type', {
          is: VisibilityType.ORGANIZATION,
          then: Joi.array().length(0),
          otherwise: Joi.array().min(1)
        })
    }).optional()
  }).min(1), // At least one field must be provided for update

  // Alert filters (query parameters)
  alertFilters: Joi.object({
    severity: Joi.string().valid(...Object.values(AlertSeverity)).optional(),
    status: Joi.string().valid('active', 'expired', 'archived').optional(),
    visibility: Joi.string().valid(...Object.values(VisibilityType)).optional(),
    createdBy: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),

  // Snooze alert
  snoozeAlert: Joi.object({
    hours: Joi.number().integer().min(1).max(168).default(24) // 1 hour to 1 week
      .messages({
        'number.min': 'Snooze duration must be at least 1 hour',
        'number.max': 'Snooze duration cannot exceed 168 hours (1 week)'
      })
  }),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // User alert filters
  userAlertFilters: Joi.object({
    status: Joi.string().valid('read', 'unread', 'snoozed').optional(),
    severity: Joi.string().valid(...Object.values(AlertSeverity)).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }),

  // Change password
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(128).required()
      .messages({
        'string.min': 'New password must be at least 6 characters long',
        'string.max': 'New password cannot exceed 128 characters'
      })
  }),

  // Optional date
  optionalDate: Joi.date().iso().optional(),

  // Optional string
  optionalString: Joi.string().optional(),

  // Group by options
  optionalGroupBy: Joi.string().valid('hour', 'day', 'week', 'month').default('day').optional(),

  // Array of ObjectIds
  arrayOfObjectIds: Joi.array().items(
    Joi.string().regex(/^[0-9a-fA-F]{24}$/)
      .messages({
        'string.pattern.base': 'Invalid ObjectId format'
      })
  ).min(1).required()
};

// Custom validation for date ranges
export const validateDateRange = (req: Request, res: Response, next: NextFunction): void => {
  const { startDate, endDate } = req.query;
  
  if (startDate && endDate) {
    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    if (start >= end) {
      next(new AppError('Start date must be before end date', 400));
      return;
    }
    
    // Limit date range to prevent performance issues
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      next(new AppError('Date range cannot exceed 365 days', 400));
      return;
    }
  }
  
  next();
};

// Validate that user exists middleware
export const validateUserExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.params.userId || req.body.userId;
    
    if (!userId) {
      next(new AppError('User ID is required', 400));
      return;
    }
    
    const { User } = await import('@/models');
    const user = await User.findById(userId);
    
    if (!user) {
      next(new AppError('User not found', 404));
      return;
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Validate that alert exists middleware
export const validateAlertExists = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const alertId = req.params.alertId || req.params.id;
    
    if (!alertId) {
      next(new AppError('Alert ID is required', 400));
      return;
    }
    
    const { Alert } = await import('@/models');
    const alert = await Alert.findById(alertId);
    
    if (!alert) {
      next(new AppError('Alert not found', 404));
      return;
    }
    
    next();
  } catch (error) {
    next(error);
  }
};
