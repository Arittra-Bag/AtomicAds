import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { DatabaseConfig } from '@/config/database';
import { appConfig, isDevelopment } from '@/config/environment';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { ReminderScheduler } from '@/services/scheduler/ReminderScheduler';

import routes from '@/routes';

class Server {
  private app: express.Application;
  private database: DatabaseConfig;
  private reminderScheduler: ReminderScheduler;

  constructor() {
    this.app = express();
    this.database = DatabaseConfig.getInstance();
    this.reminderScheduler = new ReminderScheduler();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: isDevelopment ? false : undefined,
    }));

    // CORS configuration
    this.app.use(cors({
      origin: isDevelopment ? '*' : process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isDevelopment ? 1000 : 100, // Limit each IP to 100 requests per windowMs in production
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging in development
    if (isDevelopment) {
      this.app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Alerting & Notification Platform API',
        version: '1.0.0',
        documentation: '/api/health',
        endpoints: {
          health: '/api/health',
          auth: '/api/auth',
          admin: '/api/admin',
          user: '/api/user'
        }
      });
    });

    // API routes
    this.app.use('/api', routes);

    // 404 handler for unknown routes
    this.app.use(notFoundHandler);
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use(errorHandler);

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      this.gracefulShutdown('SIGTERM');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('SIGTERM');
    });

    // Handle process termination signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.database.connect();

      // Start the server
      const server = this.app.listen(appConfig.port, () => {
        console.log(`🚀 Server running on port ${appConfig.port}`);
        console.log(`🌍 Environment: ${appConfig.nodeEnv}`);
        console.log(`📡 API Base URL: http://localhost:${appConfig.port}/api`);
        
        if (isDevelopment) {
          console.log('\n📚 Available Endpoints:');
          console.log('   Health Check: GET /api/health');
          console.log('   Authentication: POST /api/auth/login');
          console.log('   Admin Panel: /api/admin/*');
          console.log('   User Panel: /api/user/*');
          console.log('\n🔧 Development Features:');
          console.log('   - Detailed error logging');
          console.log('   - Request logging');
          console.log('   - Relaxed CORS policy');
        }
      });

      // Start reminder scheduler
      this.reminderScheduler.start();
      const schedulerStatus = this.reminderScheduler.getStatus();
      console.log(`⏰ Reminder scheduler: ${schedulerStatus.isRunning ? 'RUNNING' : 'STOPPED'}`);
      if (schedulerStatus.nextRun) {
        console.log(`📅 Next reminder check: ${schedulerStatus.nextRun.toISOString()}`);
      }

      // Graceful shutdown setup
      this.setupGracefulShutdown(server);

      console.log('✅ Server started successfully');

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(server: any): void {
    const shutdown = (signal: string) => {
      console.log(`\n📤 Received ${signal}. Starting graceful shutdown...`);

      server.close((err?: Error) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          process.exit(1);
        }

        console.log('🛑 HTTP server closed');
        this.gracefulShutdown(signal);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n🔄 Graceful shutdown initiated by ${signal}`);

    try {
      // Stop reminder scheduler
      this.reminderScheduler.stop();
      console.log('⏰ Reminder scheduler stopped');

      // Disconnect from database
      await this.database.disconnect();
      console.log('💾 Database disconnected');

      console.log('✅ Graceful shutdown completed');
      process.exit(0);

    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  // Method to get app instance (useful for testing)
  public getApp(): express.Application {
    return this.app;
  }

  // Method to get scheduler instance
  public getScheduler(): ReminderScheduler {
    return this.reminderScheduler;
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new Server();
  server.start().catch((error) => {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  });
}

export default Server;
