import { IAlertSubject, IAlertObserver, IAlert, IUser } from '@/types';

export class AlertSubject implements IAlertSubject {
  private observers: IAlertObserver[] = [];

  public addObserver(observer: IAlertObserver): void {
    this.observers.push(observer);
    console.log(`✅ Observer added. Total observers: ${this.observers.length}`);
  }

  public removeObserver(observer: IAlertObserver): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
      console.log(`❌ Observer removed. Total observers: ${this.observers.length}`);
    } else {
      console.warn('⚠️ Observer not found for removal');
    }
  }

  public async notifyObservers(alert: IAlert, users: IUser[]): Promise<void> {
    console.log(`📢 Notifying ${this.observers.length} observers for alert: ${alert.title}`);

    if (this.observers.length === 0) {
      console.warn('⚠️ No observers registered to notify');
      return;
    }

    try {
      // Notify all observers in parallel for better performance
      const notificationPromises = this.observers.map(async (observer, index) => {
        try {
          await observer.update(alert, users);
          console.log(`✅ Observer ${index + 1} notified successfully`);
        } catch (error) {
          console.error(`❌ Observer ${index + 1} failed:`, error);
          // Continue with other observers even if one fails
        }
      });

      await Promise.all(notificationPromises);
      console.log(`📢 All observers notified for alert: ${alert.title}`);

    } catch (error) {
      console.error('❌ Error notifying observers:', error);
    }
  }

  public getObserverCount(): number {
    return this.observers.length;
  }

  public clearObservers(): void {
    this.observers = [];
    console.log('🧹 All observers cleared');
  }

  // Method to notify observers with additional context
  public async notifyObserversWithContext(
    alert: IAlert, 
    users: IUser[], 
    context: { 
      action: 'created' | 'updated' | 'reminder' | 'expired';
      metadata?: any;
    }
  ): Promise<void> {
    console.log(`📢 Notifying observers for ${context.action} action on alert: ${alert.title}`);

    // Add context to the alert object temporarily for observers
    const alertWithContext = {
      ...alert.toObject(),
      _context: context
    } as IAlert & { _context: any };

    await this.notifyObservers(alertWithContext, users);
  }

  // Method to get observer types (useful for debugging)
  public getObserverTypes(): string[] {
    return this.observers.map(observer => observer.constructor.name);
  }
}
