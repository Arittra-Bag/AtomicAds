import { IAlertState, IUserAlertPreference } from '@/types';

// Abstract base state class
export abstract class BaseAlertState implements IAlertState {
  abstract markAsRead(preference: IUserAlertPreference): void;
  abstract snooze(preference: IUserAlertPreference, hours: number): void;
  abstract unsnooze(preference: IUserAlertPreference): void;
  abstract canReceiveReminder(preference: IUserAlertPreference): boolean;

  protected logStateChange(preference: IUserAlertPreference, action: string, fromState: string, toState: string): void {
    console.log(`🔄 State change for user ${preference.userId} alert ${preference.alertId}: ${action} (${fromState} → ${toState})`);
  }
}

// Unread state - user hasn't read the alert yet
export class UnreadState extends BaseAlertState {
  public markAsRead(preference: IUserAlertPreference): void {
    preference.isRead = true;
    preference.isSnoozed = false;
    preference.snoozedUntil = null;
    
    this.logStateChange(preference, 'marked as read', 'unread', 'read');
  }

  public snooze(preference: IUserAlertPreference, hours: number = 24): void {
    preference.isSnoozed = true;
    preference.snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    this.logStateChange(preference, `snoozed for ${hours}h`, 'unread', 'snoozed');
  }

  public unsnooze(preference: IUserAlertPreference): void {
    // Already unread, so just ensure snooze is cleared
    preference.isSnoozed = false;
    preference.snoozedUntil = null;
    
    this.logStateChange(preference, 'unsnooze (was already unread)', 'unread', 'unread');
  }

  public canReceiveReminder(preference: IUserAlertPreference): boolean {
    // Can receive reminders if not currently snoozed
    const now = new Date();
    const isCurrentlySnoozed = preference.isSnoozed && 
                              preference.snoozedUntil && 
                              preference.snoozedUntil > now;
    
    return !isCurrentlySnoozed;
  }
}

// Read state - user has read the alert
export class ReadState extends BaseAlertState {
  public markAsRead(preference: IUserAlertPreference): void {
    // Already read, no state change needed
    this.logStateChange(preference, 'mark as read (already read)', 'read', 'read');
  }

  public snooze(preference: IUserAlertPreference, hours: number = 24): void {
    // Can't snooze a read alert - user has already acknowledged it
    console.warn(`⚠️ Cannot snooze read alert for user ${preference.userId}`);
  }

  public unsnooze(preference: IUserAlertPreference): void {
    // Already read, ensure snooze is cleared if it was set
    preference.isSnoozed = false;
    preference.snoozedUntil = null;
    
    this.logStateChange(preference, 'unsnooze (was read)', 'read', 'read');
  }

  public canReceiveReminder(preference: IUserAlertPreference): boolean {
    // Read alerts don't need reminders
    return false;
  }
}

// Snoozed state - user has temporarily dismissed the alert
export class SnoozedState extends BaseAlertState {
  public markAsRead(preference: IUserAlertPreference): void {
    preference.isRead = true;
    preference.isSnoozed = false;
    preference.snoozedUntil = null;
    
    this.logStateChange(preference, 'marked as read', 'snoozed', 'read');
  }

  public snooze(preference: IUserAlertPreference, hours: number = 24): void {
    // Extend or update snooze time
    preference.snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    this.logStateChange(preference, `snooze extended for ${hours}h`, 'snoozed', 'snoozed');
  }

  public unsnooze(preference: IUserAlertPreference): void {
    preference.isSnoozed = false;
    preference.snoozedUntil = null;
    
    this.logStateChange(preference, 'unsnoozed', 'snoozed', 'unread');
  }

  public canReceiveReminder(preference: IUserAlertPreference): boolean {
    // Check if snooze period has expired
    const now = new Date();
    const isSnoozeExpired = !preference.snoozedUntil || (preference.snoozedUntil && preference.snoozedUntil <= now);
    
    if (isSnoozeExpired) {
      // Auto-transition to unread state
      this.unsnooze(preference);
      return true;
    }
    
    return false;
  }
}

// State context class that manages state transitions
export class AlertPreferenceStateContext {
  private static unreadState = new UnreadState();
  private static readState = new ReadState();
  private static snoozedState = new SnoozedState();

  public static getCurrentState(preference: IUserAlertPreference): IAlertState {
    if (preference.isRead) {
      return this.readState;
    } else if (preference.isSnoozed && this.isCurrentlySnoozed(preference)) {
      return this.snoozedState;
    } else {
      return this.unreadState;
    }
  }

  private static isCurrentlySnoozed(preference: IUserAlertPreference): boolean {
    const now = new Date();
    return preference.isSnoozed && 
           preference.snoozedUntil !== null && 
           preference.snoozedUntil !== undefined &&
           preference.snoozedUntil > now;
  }

  public static markAsRead(preference: IUserAlertPreference): void {
    const currentState = this.getCurrentState(preference);
    currentState.markAsRead(preference);
  }

  public static snooze(preference: IUserAlertPreference, hours: number = 24): void {
    const currentState = this.getCurrentState(preference);
    currentState.snooze(preference, hours);
  }

  public static unsnooze(preference: IUserAlertPreference): void {
    const currentState = this.getCurrentState(preference);
    currentState.unsnooze(preference);
  }

  public static canReceiveReminder(preference: IUserAlertPreference): boolean {
    const currentState = this.getCurrentState(preference);
    return currentState.canReceiveReminder(preference);
  }

  public static getStateName(preference: IUserAlertPreference): string {
    if (preference.isRead) {
      return 'READ';
    } else if (preference.isSnoozed && this.isCurrentlySnoozed(preference)) {
      return 'SNOOZED';
    } else {
      return 'UNREAD';
    }
  }

  // Method to handle automatic state transitions (e.g., expired snoozes)
  public static processAutomaticTransitions(preference: IUserAlertPreference): boolean {
    let hasChanged = false;

    // Check if snooze has expired
    if (preference.isSnoozed && !this.isCurrentlySnoozed(preference)) {
      this.unsnooze(preference);
      hasChanged = true;
    }

    return hasChanged;
  }

  // Method to get all possible actions for current state
  public static getAvailableActions(preference: IUserAlertPreference): string[] {
    const actions: string[] = [];

    if (!preference.isRead) {
      actions.push('markAsRead');
    }

    if (!preference.isRead && !this.isCurrentlySnoozed(preference)) {
      actions.push('snooze');
    }

    if (preference.isSnoozed) {
      actions.push('unsnooze');
    }

    return actions;
  }
}
