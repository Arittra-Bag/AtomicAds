import { BaseNotificationChannel } from './BaseNotificationChannel';
import { IAlert, IUser, DeliveryType } from '@/types';

export class SMSNotificationChannel extends BaseNotificationChannel {
  constructor() {
    super(DeliveryType.SMS);
  }

  public async send(alert: IAlert, user: IUser): Promise<boolean> {
    try {
      // This is a placeholder implementation for future SMS integration
      // In a real implementation, this would integrate with services like:
      // - Twilio
      // - AWS SNS
      // - Other SMS providers
      
      const smsContent = this.generateSMSContent(alert, user);
      
      console.log(`📱 SMS notification would be sent to ${this.maskPhoneNumber(user.email)}:`);
      console.log(`Message: ${smsContent}`);
      
      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // For MVP, we'll just log and return true
      // In production, this would actually send the SMS
      return true;
    } catch (error) {
      console.error(`❌ Failed to send SMS notification to user ${user.name}:`, error);
      return false;
    }
  }

  private generateSMSContent(alert: IAlert, user: IUser): string {
    // SMS messages should be concise due to character limits
    const emoji = this.getSMSSeverityEmoji(alert.severity);
    
    let message = `${emoji} ${alert.severity} Alert: ${alert.title}\n\n${alert.message}`;
    
    // Truncate if too long (typical SMS limit is 160 characters)
    if (message.length > 150) {
      message = message.substring(0, 147) + '...';
    }
    
    return message;
  }

  private getSMSSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'Critical': return '🚨';
      case 'Warning': return '⚠️';
      case 'Info': return 'ℹ️';
      default: return '🔔';
    }
  }

  private maskPhoneNumber(email: string): string {
    // In a real implementation, user would have a phone number field
    // For now, we'll simulate with a masked version
    return `***-***-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  // Method to setup SMS configuration (for future use)
  public configure(config: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    service?: 'twilio' | 'sns' | 'custom';
  }): void {
    // Store SMS configuration for actual implementation
    console.log('📱 SMS channel configured:', config.service || 'twilio');
  }

  // Method to validate phone number format (for future use)
  public validatePhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phoneNumber);
  }
}
