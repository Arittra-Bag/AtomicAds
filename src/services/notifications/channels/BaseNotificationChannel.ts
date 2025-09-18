import { INotificationChannel, IAlert, IUser, DeliveryType } from '@/types';

export abstract class BaseNotificationChannel implements INotificationChannel {
  protected deliveryType: DeliveryType;

  constructor(deliveryType: DeliveryType) {
    this.deliveryType = deliveryType;
  }

  public getType(): DeliveryType {
    return this.deliveryType;
  }

  public abstract send(alert: IAlert, user: IUser): Promise<boolean>;

  protected formatMessage(alert: IAlert, user: IUser): string {
    return `
🔔 ${alert.severity} Alert: ${alert.title}

Hi ${user.name},

${alert.message}

Severity: ${alert.severity}
Created: ${alert.createdAt}
${alert.expiryTime ? `Expires: ${alert.expiryTime}` : ''}

---
This is an automated notification from the Alerting Platform.
    `.trim();
  }

  protected formatTitle(alert: IAlert): string {
    const emoji = this.getSeverityEmoji(alert.severity);
    return `${emoji} ${alert.severity}: ${alert.title}`;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'Critical': return '🚨';
      case 'Warning': return '⚠️';
      case 'Info': return 'ℹ️';
      default: return '🔔';
    }
  }
}
