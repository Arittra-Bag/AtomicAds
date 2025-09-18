import { BaseNotificationChannel } from './BaseNotificationChannel';
import { IAlert, IUser, DeliveryType } from '@/types';

export class EmailNotificationChannel extends BaseNotificationChannel {
  constructor() {
    super(DeliveryType.EMAIL);
  }

  public async send(alert: IAlert, user: IUser): Promise<boolean> {
    try {
      // This is a placeholder implementation for future email integration
      // In a real implementation, this would integrate with services like:
      // - SendGrid
      // - AWS SES
      // - NodeMailer with SMTP
      
      const emailContent = this.generateEmailContent(alert, user);
      
      console.log(`📧 Email notification would be sent to ${user.email}:`);
      console.log(`Subject: ${emailContent.subject}`);
      console.log(`Body: ${emailContent.body}`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // For MVP, we'll just log and return true
      // In production, this would actually send the email
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email notification to ${user.email}:`, error);
      return false;
    }
  }

  private generateEmailContent(alert: IAlert, user: IUser): { subject: string; body: string } {
    const subject = this.formatTitle(alert);
    
    const body = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${subject}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert-critical { border-left: 4px solid #dc3545; }
        .alert-warning { border-left: 4px solid #ffc107; }
        .alert-info { border-left: 4px solid #17a2b8; }
        .footer { background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Alert Notification</h1>
    </div>
    
    <div class="content alert-${alert.severity.toLowerCase()}">
        <h2>${alert.title}</h2>
        <p><strong>Hello ${user.name},</strong></p>
        <p>${alert.message}</p>
        
        <hr>
        
        <p><strong>Alert Details:</strong></p>
        <ul>
            <li><strong>Severity:</strong> ${alert.severity}</li>
            <li><strong>Created:</strong> ${new Date(alert.createdAt).toLocaleString()}</li>
            ${alert.expiryTime ? `<li><strong>Expires:</strong> ${new Date(alert.expiryTime).toLocaleString()}</li>` : ''}
        </ul>
    </div>
    
    <div class="footer">
        <p>This is an automated notification from the Alerting Platform.</p>
        <p>Please do not reply to this email.</p>
    </div>
</body>
</html>
    `.trim();

    return { subject, body };
  }

  // Method to setup email configuration (for future use)
  public configure(config: {
    smtpHost?: string;
    smtpPort?: number;
    username?: string;
    password?: string;
    apiKey?: string;
    service?: 'sendgrid' | 'ses' | 'smtp';
  }): void {
    // Store email configuration for actual implementation
    console.log('📧 Email channel configured:', config.service || 'smtp');
  }
}
