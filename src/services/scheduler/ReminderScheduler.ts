import * as cron from 'node-cron';
import { AlertService } from '@/services/alerts/AlertService';
import { appConfig } from '@/config/environment';

export class ReminderScheduler {
  private alertService: AlertService;
  private isRunning: boolean = false;
  private task: cron.ScheduledTask | null = null;

  constructor() {
    this.alertService = new AlertService();
  }

  // Start the reminder scheduler
  public start(): void {
    if (this.isRunning) {
      console.log('⚠️ Reminder scheduler is already running');
      return;
    }

    // Calculate cron schedule based on reminder interval
    const cronSchedule = this.getCronSchedule(appConfig.reminderIntervalMinutes);

    console.log(`🕐 Starting reminder scheduler with interval: ${appConfig.reminderIntervalMinutes} minutes`);
    console.log(`📅 Cron schedule: ${cronSchedule}`);

    // Create and start the cron job
    this.task = cron.schedule(cronSchedule, this.processReminders.bind(this), {
      scheduled: false,
      timezone: 'UTC'
    });

    this.task.start();
    this.isRunning = true;

    console.log('✅ Reminder scheduler started successfully');
  }

  // Stop the reminder scheduler
  public stop(): void {
    if (!this.isRunning || !this.task) {
      console.log('⚠️ Reminder scheduler is not running');
      return;
    }

    this.task.stop();
    this.task = null;
    this.isRunning = false;

    console.log('🛑 Reminder scheduler stopped');
  }

  // Check if scheduler is running
  public getStatus(): { isRunning: boolean; schedule?: string; nextRun?: Date } {
    const status: any = { isRunning: this.isRunning };

    if (this.isRunning && this.task) {
      status.schedule = this.getCronSchedule(appConfig.reminderIntervalMinutes);
      
      // Get next execution time (approximated)
      const now = new Date();
      const nextRun = new Date(now.getTime() + appConfig.reminderIntervalMinutes * 60 * 1000);
      status.nextRun = nextRun;
    }

    return status;
  }

  // Process reminders (called by cron job)
  private async processReminders(): Promise<void> {
    try {
      console.log('🔄 Reminder scheduler: Processing reminders...');
      const startTime = Date.now();

      await this.alertService.processReminders();

      const duration = Date.now() - startTime;
      console.log(`✅ Reminder processing completed in ${duration}ms`);

    } catch (error) {
      console.error('❌ Error in reminder scheduler:', error);
    }
  }

  // Convert minutes to cron schedule
  private getCronSchedule(minutes: number): string {
    if (minutes < 60) {
      // Every X minutes
      return `*/${minutes} * * * *`;
    } else if (minutes === 60) {
      // Every hour
      return '0 * * * *';
    } else if (minutes === 120) {
      // Every 2 hours
      return '0 */2 * * *';
    } else if (minutes === 180) {
      // Every 3 hours
      return '0 */3 * * *';
    } else if (minutes === 240) {
      // Every 4 hours
      return '0 */4 * * *';
    } else if (minutes === 360) {
      // Every 6 hours
      return '0 */6 * * *';
    } else if (minutes === 720) {
      // Every 12 hours
      return '0 */12 * * *';
    } else if (minutes === 1440) {
      // Every 24 hours (daily)
      return '0 0 * * *';
    } else {
      // For other intervals, convert to hours if possible, otherwise use minutes
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;

      if (remainingMinutes === 0 && hours <= 23) {
        return `0 */${hours} * * *`;
      } else {
        // Fall back to minute-based schedule (max every 30 minutes for performance)
        const interval = Math.max(30, Math.min(minutes, 60));
        return `*/${interval} * * * *`;
      }
    }
  }

  // Manual trigger for testing
  public async triggerManualRun(): Promise<void> {
    console.log('🔧 Manual reminder processing triggered');
    await this.processReminders();
  }

  // Restart the scheduler with new configuration
  public restart(): void {
    console.log('🔄 Restarting reminder scheduler...');
    this.stop();
    
    // Wait a moment before restarting
    setTimeout(() => {
      this.start();
    }, 1000);
  }

  // Get scheduler statistics
  public getStats(): {
    isRunning: boolean;
    intervalMinutes: number;
    schedule: string;
    uptime?: number;
    nextRun?: Date;
  } {
    const stats = {
      isRunning: this.isRunning,
      intervalMinutes: appConfig.reminderIntervalMinutes,
      schedule: this.getCronSchedule(appConfig.reminderIntervalMinutes),
      uptime: undefined as number | undefined,
      nextRun: undefined as Date | undefined
    };

    if (this.isRunning) {
      // Calculate approximate next run time
      const now = new Date();
      stats.nextRun = new Date(now.getTime() + appConfig.reminderIntervalMinutes * 60 * 1000);
    }

    return stats;
  }

  // Validate cron schedule
  private validateCronSchedule(schedule: string): boolean {
    return cron.validate(schedule);
  }

  // Set custom schedule (for advanced use cases)
  public setCustomSchedule(cronSchedule: string): void {
    if (!this.validateCronSchedule(cronSchedule)) {
      throw new Error(`Invalid cron schedule: ${cronSchedule}`);
    }

    console.log(`🔧 Setting custom reminder schedule: ${cronSchedule}`);

    this.stop();

    this.task = cron.schedule(cronSchedule, this.processReminders.bind(this), {
      scheduled: false,
      timezone: 'UTC'
    });

    this.task.start();
    this.isRunning = true;

    console.log('✅ Custom reminder schedule set successfully');
  }
}
