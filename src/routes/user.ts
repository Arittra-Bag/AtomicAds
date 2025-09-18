import { Router } from 'express';
import Joi from 'joi';
import { UserController } from '@/controllers/UserController';
import { authenticate, requireUser } from '@/middleware/auth';
import { validate, validateQuery, validateParams, schemas } from '@/middleware/validation';

const router = Router();
const userController = new UserController();

// All user routes require authentication
router.use(authenticate, requireUser);

// User alert routes
router.get('/alerts', 
  validateQuery(schemas.userAlertFilters),
  userController.getMyAlerts
);

router.get('/notifications', 
  validateQuery(Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(50)
  })),
  userController.getMyNotifications
);

router.patch('/alerts/:alertId/read', 
  validateParams(Joi.object({ alertId: schemas.objectId })),
  userController.markAlertAsRead
);

router.patch('/alerts/:alertId/unread', 
  validateParams(Joi.object({ alertId: schemas.objectId })),
  userController.markAlertAsUnread
);

router.patch('/alerts/:alertId/snooze', 
  validateParams(Joi.object({ alertId: schemas.objectId })),
  validate(schemas.snoozeAlert),
  userController.snoozeAlert
);

router.patch('/alerts/:alertId/unsnooze', 
  validateParams(Joi.object({ alertId: schemas.objectId })),
  userController.unsnoozeAlert
);

// Bulk operations
router.patch('/alerts/bulk/read', 
  validate(Joi.object({
    alertIds: schemas.arrayOfObjectIds
  })),
  userController.bulkMarkAsRead
);

router.patch('/alerts/bulk/snooze', 
  validate(Joi.object({
    alertIds: schemas.arrayOfObjectIds,
    hours: Joi.number().integer().min(1).max(168).default(24)
  })),
  userController.bulkSnoozeAlerts
);

// User profile routes
router.get('/profile', 
  userController.getMyProfile
);

router.put('/profile', 
  validate(Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
  })),
  userController.updateMyProfile
);

// User statistics
router.get('/stats', 
  userController.getMyAlertStats
);

// Snoozed alerts
router.get('/alerts/snoozed', 
  validateQuery(schemas.pagination),
  userController.getSnoozedAlerts
);

export default router;
