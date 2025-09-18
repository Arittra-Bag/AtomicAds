import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/types';
import { isDevelopment } from '@/config/environment';

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    status: number;
    stack?: string;
    details?: any;
  };
}

// Global error handling middleware
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let isOperational = false;

  // Handle different types of errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    isOperational = error.isOperational;
  } else if (error.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    message = 'Validation error';
    const details = Object.values((error as any).errors).map((err: any) => err.message);
    message = `Validation error: ${details.join(', ')}`;
  } else if (error.name === 'CastError') {
    // Mongoose cast error (invalid ObjectId)
    statusCode = 400;
    message = 'Invalid ID format';
  } else if ((error as any).code === 11000) {
    // MongoDB duplicate key error
    statusCode = 400;
    const field = Object.keys((error as any).keyValue)[0];
    message = `Duplicate value for field: ${field}`;
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
  } else if (error.name === 'MongoServerError') {
    statusCode = 500;
    message = 'Database error';
  }

  // Log error for debugging
  console.error(`❌ Error ${statusCode}: ${message}`);
  if (isDevelopment || !isOperational) {
    console.error('Error stack:', error.stack);
  }

  // Prepare error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message,
      status: statusCode
    }
  };

  // Include stack trace in development
  if (isDevelopment) {
    errorResponse.error.stack = error.stack;
  }

  // Include additional details for validation errors
  if (error.name === 'ValidationError' && (error as any).errors) {
    errorResponse.error.details = Object.values((error as any).errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
  }

  res.status(statusCode).json(errorResponse);
};

// 404 error handler for routes not found
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
};

// Async error wrapper to catch errors in async route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Rate limiting error handler
export const rateLimitHandler = (req: Request, res: Response): void => {
  res.status(429).json({
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      status: 429
    }
  });
};

// CORS error handler
export const corsErrorHandler = (req: Request, res: Response): void => {
  res.status(400).json({
    success: false,
    error: {
      message: 'CORS policy violation',
      status: 400
    }
  });
};

// Custom error classes for specific scenarios
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400);
    this.name = 'ValidationError';
    if (details) {
      (this as any).details = details;
    }
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed') {
    super(message, 500, false); // Not operational - database issue
    this.name = 'DatabaseError';
  }
}

// Helper function to create error responses consistently
export const createErrorResponse = (message: string, statusCode: number, details?: any) => {
  const response: any = {
    success: false,
    error: {
      message,
      status: statusCode
    }
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};

// Helper function to create success responses consistently
export const createSuccessResponse = (data: any, message?: string, meta?: any) => {
  const response: any = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return response;
};
