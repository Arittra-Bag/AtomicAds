import { 
  INotificationStrategy, 
  INotificationChannel, 
  IAlert, 
  IUser, 
  DeliveryType 
} from '@/types';
import { 
  InAppNotificationChannel, 
  EmailNotificationChannel, 
  SMSNotificationChannel 
} from './channels';

export class NotificationStrategy implements INotificationStrategy {
  private channels: Map<DeliveryType, INotificationChannel> = new Map();

  constructor() {
    // Initialize default channels
    this.initializeDefaultChannels();
  }

  private initializeDefaultChannels(): void {
    this.addChannel(new InAppNotificationChannel());
    this.addChannel(new EmailNotificationChannel());
    this.addChannel(new SMSNotificationChannel());
  }

  public addChannel(channel: INotificationChannel): void {
    this.channels.set(channel.getType(), channel);
    console.log(`✅ Added notification channel: ${channel.getType()}`);
  }

  public removeChannel(type: DeliveryType): void {
    if (this.channels.has(type)) {
      this.channels.delete(type);
      console.log(`❌ Removed notification channel: ${type}`);
    } else {
      console.warn(`⚠️ Channel ${type} not found for removal`);
    }
  }

  public async sendNotification(alert: IAlert, user: IUser, deliveryType: DeliveryType): Promise<boolean> {
    const channel = this.channels.get(deliveryType);
    
    if (!channel) {
      console.error(`❌ No channel found for delivery type: ${deliveryType}`);
      return false;
    }

    try {
      const success = await channel.send(alert, user);
      
      if (success) {
        console.log(`✅ Notification sent successfully via ${deliveryType} to ${user.name}`);
      } else {
        console.error(`❌ Failed to send notification via ${deliveryType} to ${user.name}`);
      }
      
      return success;
    } catch (error) {
      console.error(`❌ Error sending notification via ${deliveryType} to ${user.name}:`, error);
      return false;
    }
  }

  public async sendToMultipleChannels(
    alert: IAlert, 
    user: IUser, 
    deliveryTypes: DeliveryType[]
  ): Promise<{ [key in DeliveryType]?: boolean }> {
    const results: { [key in DeliveryType]?: boolean } = {};
    
    const promises = deliveryTypes.map(async (deliveryType) => {
      results[deliveryType] = await this.sendNotification(alert, user, deliveryType);
    });

    await Promise.all(promises);
    return results;
  }

  public getAvailableChannels(): DeliveryType[] {
    return Array.from(this.channels.keys());
  }

  public hasChannel(deliveryType: DeliveryType): boolean {
    return this.channels.has(deliveryType);
  }

  public getChannel(deliveryType: DeliveryType): INotificationChannel | undefined {
    return this.channels.get(deliveryType);
  }

  // Bulk notification method for sending to multiple users
  public async sendBulkNotifications(
    alert: IAlert, 
    users: IUser[], 
    deliveryType: DeliveryType
  ): Promise<{ successful: number; failed: number; results: Array<{ user: IUser; success: boolean }> }> {
    const results: Array<{ user: IUser; success: boolean }> = [];
    let successful = 0;
    let failed = 0;

    // Send notifications in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (user) => {
        const success = await this.sendNotification(alert, user, deliveryType);
        results.push({ user, success });
        
        if (success) {
          successful++;
        } else {
          failed++;
        }
        
        return { user, success };
      });

      await Promise.all(batchPromises);
      
      // Add a small delay between batches to prevent rate limiting
      if (i + batchSize < users.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`📊 Bulk notification summary: ${successful} successful, ${failed} failed out of ${users.length} users`);
    
    return { successful, failed, results };
  }

  // Method to validate if a delivery type is supported
  public isDeliveryTypeSupported(deliveryType: DeliveryType): boolean {
    return this.hasChannel(deliveryType);
  }

  // Method to get channel statistics (for monitoring)
  public getChannelStats(): { [key in DeliveryType]?: { isActive: boolean; lastUsed?: Date } } {
    const stats: { [key in DeliveryType]?: { isActive: boolean; lastUsed?: Date } } = {};
    
    this.channels.forEach((channel, type) => {
      stats[type] = {
        isActive: true,
        // In a real implementation, we'd track last usage time
        lastUsed: new Date()
      };
    });
    
    return stats;
  }
}
