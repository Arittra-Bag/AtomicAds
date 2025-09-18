import mongoose from 'mongoose';

export class DatabaseConfig {
  private static instance: DatabaseConfig;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig();
    }
    return DatabaseConfig.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Database already connected');
      return;
    }

    try {
      const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://arittrabag:HcYGWHsobaGCjAYv@cluster0.sxa8js9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
      
      await mongoose.connect(mongoUrl, {
        dbName: 'alerting_platform'
      });

      this.isConnected = true;
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      process.exit(1);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('📤 Database disconnected');
    } catch (error) {
      console.error('❌ Database disconnection failed:', error);
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}
