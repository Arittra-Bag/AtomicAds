import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '@/models';
import { AppError } from '@/types';
import { appConfig } from '@/config/environment';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'user';
    teamId?: string;
  };
}

// JWT Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token required', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new AppError('Authentication token required', 401);
    }

    // Verify JWT token
    const decoded = jwt.verify(token, appConfig.jwtSecret) as any;
    
    // Find user by ID
    const user = await User.findById(decoded.id).select('+password').populate('teamId', 'name');
    
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      teamId: user.teamId?.toString()
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid authentication token', 401));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Authentication token expired', 401));
    } else {
      next(error);
    }
  }
};

// Authorization middleware for admin-only routes
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  
  if (!user || user.role !== 'admin') {
    next(new AppError('Admin access required', 403));
    return;
  }
  
  next();
};

// Authorization middleware for user access (both admin and user)
export const requireUser = (req: Request, res: Response, next: NextFunction): void => {
  const user = req.user;
  
  if (!user) {
    next(new AppError('User authentication required', 401));
    return;
  }
  
  next();
};

// Middleware to check if user can access specific user data
export const requireSelfOrAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const currentUser = req.user;
  const targetUserId = req.params.userId || req.body.userId;
  
  if (!currentUser) {
    next(new AppError('Authentication required', 401));
    return;
  }
  
  // Allow if admin or accessing own data
  if (currentUser.role === 'admin' || currentUser.id === targetUserId) {
    next();
    return;
  }
  
  next(new AppError('Access denied', 403));
};

// Generate JWT token
export const generateToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    appConfig.jwtSecret,
    { 
      expiresIn: '7d', // Token expires in 7 days
      issuer: 'alerting-platform',
      audience: 'alerting-platform-users'
    }
  );
};

// Middleware to extract user ID from token without requiring authentication
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        try {
          const decoded = jwt.verify(token, appConfig.jwtSecret) as any;
          const user = await User.findById(decoded.id).populate('teamId', 'name');
          
          if (user && user.isActive) {
            req.user = {
              id: user._id.toString(),
              email: user.email,
              name: user.name,
              role: user.role,
              teamId: user.teamId?.toString()
            };
          }
        } catch (error) {
          // Ignore token errors for optional auth
          console.log('Optional auth token invalid, continuing without user');
        }
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};
