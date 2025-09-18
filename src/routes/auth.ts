import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';
import { validate, schemas } from '@/middleware/validation';
import { authenticate, requireAdmin } from '@/middleware/auth';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', 
  validate(schemas.createUser), 
  authController.register
);

router.post('/login', 
  validate(schemas.login), 
  authController.login
);

// Protected routes (require authentication)
router.get('/me', 
  authenticate, 
  authController.getCurrentUser
);

router.post('/logout', 
  authenticate, 
  authController.logout
);

router.post('/refresh', 
  authenticate, 
  authController.refreshToken
);

router.post('/change-password', 
  authenticate,
  validate(schemas.changePassword),
  authController.changePassword
);

router.post('/validate', 
  authenticate, 
  authController.validateToken
);

// Admin routes
router.post('/users', 
  authenticate,
  requireAdmin,
  validate(schemas.createUser),
  authController.createUser
);

router.put('/users/:id', 
  authenticate,
  requireAdmin,
  authController.updateUser
);

router.patch('/users/:id/deactivate', 
  authenticate,
  requireAdmin,
  authController.deactivateUser
);

router.patch('/users/:id/reactivate', 
  authenticate,
  requireAdmin,
  authController.reactivateUser
);

export default router;
