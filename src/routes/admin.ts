import { Router } from 'express';
import Joi from 'joi';
import { AdminController } from '@/controllers/AdminController';
import { authenticate, requireAdmin } from '@/middleware/auth';
import { validate, validateQuery, validateParams, schemas, validateDateRange } from '@/middleware/validation';

const router = Router();
const adminController = new AdminController();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Alert management routes
router.post('/alerts', 
  validate(schemas.createAlert),
  adminController.createAlert
);

router.get('/alerts', 
  validateQuery(schemas.alertFilters),
  validateDateRange,
  adminController.getAlerts
);

router.get('/alerts/:id', 
  validateParams(Joi.object({ id: schemas.objectId })),
  adminController.getAlert
);

router.put('/alerts/:id', 
  validateParams(Joi.object({ id: schemas.objectId })),
  validate(schemas.updateAlert),
  adminController.updateAlert
);

router.patch('/alerts/:id/archive', 
  validateParams(Joi.object({ id: schemas.objectId })),
  adminController.archiveAlert
);

// Alert delivery monitoring
router.get('/alerts/:id/delivery-status', 
  validateParams(Joi.object({ id: schemas.objectId })),
  adminController.getAlertDeliveryStatus
);

// Analytics routes
router.get('/analytics', 
  adminController.getAnalytics
);

router.get('/analytics/detailed', 
  validateQuery(Joi.object({
    startDate: schemas.optionalDate,
    endDate: schemas.optionalDate,
    groupBy: schemas.optionalGroupBy
  })),
  validateDateRange,
  adminController.getDetailedAnalytics
);

// User management routes
router.get('/users', 
  validateQuery(Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().optional()
  })),
  adminController.getUsers
);

// Team management routes
router.get('/teams', 
  adminController.getTeams
);

router.post('/teams', 
  validate(schemas.createTeam),
  adminController.createTeam
);

// System operations
router.post('/reminders/trigger', 
  adminController.triggerReminders
);

export default router;
