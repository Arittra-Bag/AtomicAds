import { config } from 'dotenv';

// Load environment variables
config();

export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongoUrl: string;
  jwtSecret: string;
  reminderIntervalMinutes: number;
  defaultSnoozeHours: number;
}

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUrl: process.env.MONGO_URL || 'mongodb+srv://arittrabag:HcYGWHsobaGCjAYv@cluster0.sxa8js9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  reminderIntervalMinutes: parseInt(process.env.REMINDER_INTERVAL_MINUTES || '120', 10), // 2 hours
  defaultSnoozeHours: parseInt(process.env.DEFAULT_SNOOZE_HOURS || '24', 10) // 24 hours (1 day)
};

export const isDevelopment = appConfig.nodeEnv === 'development';
export const isProduction = appConfig.nodeEnv === 'production';
