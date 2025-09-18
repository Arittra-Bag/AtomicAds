import { Document, Types } from 'mongoose';

// Enums
export enum AlertSeverity {
  INFO = 'Info',
  WARNING = 'Warning',
  CRITICAL = 'Critical'
}

export enum DeliveryType {
  IN_APP = 'In-App',
  EMAIL = 'Email',
  SMS = 'SMS'
}

export enum VisibilityType {
  ORGANIZATION = 'Organization',
  TEAM = 'Team',
  USER = 'User'
}

export enum AlertStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  ARCHIVED = 'archived'
}

export enum NotificationStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  READ = 'read',
  SNOOZED = 'snoozed'
}

// Base Document interface
export interface BaseDocument extends Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Core Domain Interfaces
export interface IUser extends BaseDocument {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  teamId?: Types.ObjectId;
  isActive: boolean;
}

export interface ITeam extends BaseDocument {
  name: string;
  description?: string;
  isActive: boolean;
}

export interface IAlert extends BaseDocument {
  title: string;
  message: string;
  severity: AlertSeverity;
  deliveryType: DeliveryType;
  reminderFrequencyMinutes: number;
  startTime: Date;
  expiryTime?: Date;
  isActive: boolean;
  isReminderEnabled: boolean;
  visibility: {
    type: VisibilityType;
    targetIds: Types.ObjectId[]; // Organization/Team/User IDs
  };
  createdBy: Types.ObjectId;
  status: AlertStatus;
}

export interface INotificationDelivery extends BaseDocument {
  alertId: Types.ObjectId;
  userId: Types.ObjectId;
  deliveryType: DeliveryType;
  status: NotificationStatus;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  snoozedUntil?: Date | null;
  metadata?: Record<string, any>;
}

export interface IUserAlertPreference extends BaseDocument {
  userId: Types.ObjectId;
  alertId: Types.ObjectId;
  isRead: boolean;
  isSnoozed: boolean;
  snoozedUntil?: Date | null;
  lastReminderSent?: Date | null;
  reminderCount: number;
  isCurrentlySnoozed?: boolean;
}

// API Request/Response Types
export interface CreateAlertRequest {
  title: string;
  message: string;
  severity: AlertSeverity;
  deliveryType: DeliveryType;
  reminderFrequencyMinutes?: number;
  startTime?: Date;
  expiryTime?: Date;
  isReminderEnabled?: boolean;
  visibility: {
    type: VisibilityType;
    targetIds: string[];
  };
}

export interface UpdateAlertRequest {
  title?: string;
  message?: string;
  severity?: AlertSeverity;
  deliveryType?: DeliveryType;
  reminderFrequencyMinutes?: number;
  startTime?: Date;
  expiryTime?: Date;
  isActive?: boolean;
  isReminderEnabled?: boolean;
  visibility?: {
    type: VisibilityType;
    targetIds: string[];
  };
}

export interface AlertFilters {
  severity?: AlertSeverity;
  status?: AlertStatus;
  visibility?: VisibilityType;
  createdBy?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface UserAlertResponse {
  alert: IAlert;
  preference: IUserAlertPreference;
  deliveries: INotificationDelivery[];
}

export interface AnalyticsResponse {
  totalAlertsCreated: number;
  alertsDelivered: number;
  alertsRead: number;
  snoozedCount: number;
  severityBreakdown: {
    [key in AlertSeverity]: number;
  };
  activeAlertsCount: number;
  expiredAlertsCount: number;
}

// Error Types
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Notification Channel Interface
export interface INotificationChannel {
  send(alert: IAlert, user: IUser): Promise<boolean>;
  getType(): DeliveryType;
}

// Strategy Pattern Context
export interface INotificationStrategy {
  addChannel(channel: INotificationChannel): void;
  removeChannel(type: DeliveryType): void;
  sendNotification(alert: IAlert, user: IUser, deliveryType: DeliveryType): Promise<boolean>;
}

// Observer Pattern
export interface IAlertObserver {
  update(alert: IAlert, users: IUser[]): Promise<void>;
}

export interface IAlertSubject {
  addObserver(observer: IAlertObserver): void;
  removeObserver(observer: IAlertObserver): void;
  notifyObservers(alert: IAlert, users: IUser[]): Promise<void>;
}

// State Pattern for User Alert Preferences
export interface IAlertState {
  markAsRead(preference: IUserAlertPreference): void;
  snooze(preference: IUserAlertPreference, hours: number): void;
  unsnooze(preference: IUserAlertPreference): void;
  canReceiveReminder(preference: IUserAlertPreference): boolean;
}
