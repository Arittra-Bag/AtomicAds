import { DatabaseConfig } from '@/config/database';
import { User, Team, Alert, UserAlertPreference, NotificationDelivery } from '@/models';
import { AlertSeverity, DeliveryType, VisibilityType, AlertStatus, NotificationStatus } from '@/types';
import { Types } from 'mongoose';

class DataSeeder {
  private database: DatabaseConfig;

  constructor() {
    this.database = DatabaseConfig.getInstance();
  }

  public async seed(): Promise<void> {
    try {
      console.log('🌱 Starting data seeding...');
      
      await this.database.connect();
      
      // Clear existing data
      await this.clearData();
      
      // Seed data in order of dependencies
      const teams = await this.seedTeams();
      const users = await this.seedUsers(teams);
      const alerts = await this.seedAlerts(users, teams);
      await this.seedUserPreferences(users, alerts);
      await this.seedNotificationDeliveries(users, alerts);
      
      console.log('✅ Data seeding completed successfully!');
      console.log('\n📊 Seeded Data Summary:');
      console.log(`   👥 Teams: ${teams.length}`);
      console.log(`   👤 Users: ${users.length}`);
      console.log(`   🔔 Alerts: ${alerts.length}`);
      console.log('\n🔑 Login Credentials:');
      console.log('   Admin: admin@example.com / password123');
      console.log('   User: john.doe@example.com / password123');
      console.log('   User: jane.smith@example.com / password123');
      
    } catch (error) {
      console.error('❌ Error seeding data:', error);
      throw error;
    }
  }

  private async clearData(): Promise<void> {
    console.log('🧹 Clearing existing data...');
    
    await Promise.all([
      NotificationDelivery.deleteMany({}),
      UserAlertPreference.deleteMany({}),
      Alert.deleteMany({}),
      User.deleteMany({}),
      Team.deleteMany({})
    ]);
    
    console.log('✅ Existing data cleared');
  }

  private async seedTeams(): Promise<any[]> {
    console.log('👥 Seeding teams...');
    
    const teamsData = [
      {
        name: 'Engineering',
        description: 'Software development and technical teams',
        isActive: true
      },
      {
        name: 'Marketing',
        description: 'Marketing and communications team',
        isActive: true
      },
      {
        name: 'Operations',
        description: 'Operations and infrastructure team',
        isActive: true
      },
      {
        name: 'Product',
        description: 'Product management and design team',
        isActive: true
      },
      {
        name: 'Sales',
        description: 'Sales and business development team',
        isActive: true
      }
    ];

    const teams = await Team.insertMany(teamsData);
    console.log(`✅ Seeded ${teams.length} teams`);
    return teams;
  }

  private async seedUsers(teams: any[]): Promise<any[]> {
    console.log('👤 Seeding users...');
    
    const usersData = [
      // Admin users
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
        role: 'admin',
        isActive: true
      },
      {
        name: 'Sarah Connor',
        email: 'sarah.connor@example.com',
        password: 'password123',
        role: 'admin',
        teamId: teams[0]._id, // Engineering
        isActive: true
      },
      
      // Regular users
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[0]._id, // Engineering
        isActive: true
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[1]._id, // Marketing
        isActive: true
      },
      {
        name: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[0]._id, // Engineering
        isActive: true
      },
      {
        name: 'Emily Davis',
        email: 'emily.davis@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[2]._id, // Operations
        isActive: true
      },
      {
        name: 'David Wilson',
        email: 'david.wilson@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[3]._id, // Product
        isActive: true
      },
      {
        name: 'Lisa Anderson',
        email: 'lisa.anderson@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[4]._id, // Sales
        isActive: true
      },
      {
        name: 'Robert Brown',
        email: 'robert.brown@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[1]._id, // Marketing
        isActive: true
      },
      {
        name: 'Jessica Taylor',
        email: 'jessica.taylor@example.com',
        password: 'password123',
        role: 'user',
        teamId: teams[2]._id, // Operations
        isActive: true
      }
    ];

    const users = await User.insertMany(usersData);
    console.log(`✅ Seeded ${users.length} users`);
    return users;
  }

  private async seedAlerts(users: any[], teams: any[]): Promise<any[]> {
    console.log('🔔 Seeding alerts...');
    
    const admin = users.find(u => u.role === 'admin');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const alertsData = [
      // Organization-wide alerts
      {
        title: 'System Maintenance Scheduled',
        message: 'Our systems will undergo scheduled maintenance this weekend from 2 AM to 6 AM EST. During this time, you may experience brief service interruptions. We apologize for any inconvenience.',
        severity: AlertSeverity.WARNING,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 120,
        startTime: twoHoursAgo,
        expiryTime: tomorrow,
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.ORGANIZATION,
          targetIds: []
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },
      {
        title: 'New Company Policy Update',
        message: 'We have updated our remote work policy. Please review the new guidelines in the employee handbook. The changes take effect next Monday.',
        severity: AlertSeverity.INFO,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 240,
        startTime: oneHourAgo,
        expiryTime: nextWeek,
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.ORGANIZATION,
          targetIds: []
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },
      {
        title: 'Security Alert: Enable 2FA',
        message: 'URGENT: All employees must enable two-factor authentication on their accounts by end of this week. This is mandatory for security compliance.',
        severity: AlertSeverity.CRITICAL,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 60,
        startTime: twoHoursAgo,
        expiryTime: nextWeek,
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.ORGANIZATION,
          targetIds: []
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },

      // Team-specific alerts
      {
        title: 'Engineering Team: Code Review Guidelines',
        message: 'New code review guidelines have been established. All PRs must have at least 2 reviewers and pass automated tests before merging.',
        severity: AlertSeverity.INFO,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 180,
        startTime: oneHourAgo,
        expiryTime: nextWeek,
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.TEAM,
          targetIds: [teams.find(t => t.name === 'Engineering')._id]
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },
      {
        title: 'Marketing: Campaign Deadline Approaching',
        message: 'Reminder: The Q4 marketing campaign materials are due this Friday. Please submit all assets to the marketing folder.',
        severity: AlertSeverity.WARNING,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 120,
        startTime: oneHourAgo,
        expiryTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.TEAM,
          targetIds: [teams.find(t => t.name === 'Marketing')._id]
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },
      {
        title: 'Operations: Server Migration',
        message: 'The server migration is scheduled for this weekend. All ops team members should be on standby during the migration window.',
        severity: AlertSeverity.WARNING,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 180,
        startTime: twoHoursAgo,
        expiryTime: tomorrow,
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.TEAM,
          targetIds: [teams.find(t => t.name === 'Operations')._id]
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },

      // User-specific alerts
      {
        title: 'Personal: Annual Review Due',
        message: 'Your annual performance review is due next week. Please complete the self-assessment form and schedule a meeting with your manager.',
        severity: AlertSeverity.INFO,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 240,
        startTime: oneHourAgo,
        expiryTime: nextWeek,
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.USER,
          targetIds: [users.find(u => u.email === 'john.doe@example.com')._id]
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },
      {
        title: 'Training: Compliance Course Required',
        message: 'You have been assigned a mandatory compliance training course. Please complete it within the next 2 weeks.',
        severity: AlertSeverity.WARNING,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 360,
        startTime: twoHoursAgo,
        expiryTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        isActive: true,
        isReminderEnabled: true,
        visibility: {
          type: VisibilityType.USER,
          targetIds: [
            users.find(u => u.email === 'jane.smith@example.com')._id,
            users.find(u => u.email === 'mike.johnson@example.com')._id
          ]
        },
        createdBy: admin._id,
        status: AlertStatus.ACTIVE
      },

      // Expired alert for testing
      {
        title: 'Expired: Old Announcement',
        message: 'This is an old announcement that has expired. It should not appear in active alerts.',
        severity: AlertSeverity.INFO,
        deliveryType: DeliveryType.IN_APP,
        reminderFrequencyMinutes: 120,
        startTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        expiryTime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        isActive: false,
        isReminderEnabled: false,
        visibility: {
          type: VisibilityType.ORGANIZATION,
          targetIds: []
        },
        createdBy: admin._id,
        status: AlertStatus.EXPIRED
      }
    ];

    const alerts = await Alert.insertMany(alertsData);
    console.log(`✅ Seeded ${alerts.length} alerts`);
    return alerts;
  }

  private async seedUserPreferences(users: any[], alerts: any[]): Promise<void> {
    console.log('⚙️ Seeding user preferences...');
    
    const preferences = [];
    
    for (const alert of alerts) {
      // Skip expired alerts
      if (alert.status === AlertStatus.EXPIRED) continue;
      
      let targetUsers = [];
      
      // Determine target users based on visibility
      switch (alert.visibility.type) {
        case VisibilityType.ORGANIZATION:
          targetUsers = users.filter(u => u.isActive);
          break;
        case VisibilityType.TEAM:
          targetUsers = users.filter(u => 
            u.isActive && 
            alert.visibility.targetIds.some((teamId: any) => 
              u.teamId && u.teamId.toString() === teamId.toString()
            )
          );
          break;
        case VisibilityType.USER:
          targetUsers = users.filter(u => 
            u.isActive && 
            alert.visibility.targetIds.some((userId: any) => 
              u._id.toString() === userId.toString()
            )
          );
          break;
      }
      
      // Create preferences for each target user
      for (const user of targetUsers) {
        const isRead = Math.random() > 0.7; // 30% chance of being read
        const isSnoozed = !isRead && Math.random() > 0.8; // 20% chance of being snoozed if unread
        
        preferences.push({
          userId: user._id,
          alertId: alert._id,
          isRead,
          isSnoozed,
          snoozedUntil: isSnoozed ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null, // 12 hours
          lastReminderSent: Math.random() > 0.5 ? new Date(Date.now() - 60 * 60 * 1000) : null, // 1 hour ago
          reminderCount: Math.floor(Math.random() * 3)
        });
      }
    }
    
    if (preferences.length > 0) {
      await UserAlertPreference.insertMany(preferences);
    }
    
    console.log(`✅ Seeded ${preferences.length} user preferences`);
  }

  private async seedNotificationDeliveries(users: any[], alerts: any[]): Promise<void> {
    console.log('📤 Seeding notification deliveries...');
    
    const deliveries = [];
    
    for (const alert of alerts) {
      // Skip expired alerts
      if (alert.status === AlertStatus.EXPIRED) continue;
      
      let targetUsers = [];
      
      // Determine target users based on visibility (same logic as preferences)
      switch (alert.visibility.type) {
        case VisibilityType.ORGANIZATION:
          targetUsers = users.filter(u => u.isActive);
          break;
        case VisibilityType.TEAM:
          targetUsers = users.filter(u => 
            u.isActive && 
            alert.visibility.targetIds.some((teamId: any) => 
              u.teamId && u.teamId.toString() === teamId.toString()
            )
          );
          break;
        case VisibilityType.USER:
          targetUsers = users.filter(u => 
            u.isActive && 
            alert.visibility.targetIds.some((userId: any) => 
              u._id.toString() === userId.toString()
            )
          );
          break;
      }
      
      // Create deliveries for each target user
      for (const user of targetUsers) {
        const statusRandom = Math.random();
        let status = NotificationStatus.DELIVERED;
        let readAt = null;
        let snoozedUntil = null;
        
        if (statusRandom > 0.8) {
          status = NotificationStatus.READ;
          readAt = new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000); // Read within last 2 hours
        } else if (statusRandom > 0.9) {
          status = NotificationStatus.SNOOZED;
          snoozedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000); // Snoozed for 12 hours
        }
        
        deliveries.push({
          alertId: alert._id,
          userId: user._id,
          deliveryType: alert.deliveryType,
          status,
          deliveredAt: new Date(alert.startTime.getTime() + Math.random() * 60 * 60 * 1000), // Delivered within 1 hour of alert creation
          readAt,
          snoozedUntil,
          metadata: {
            formattedTitle: `${alert.severity}: ${alert.title}`,
            formattedMessage: alert.message,
            severity: alert.severity,
            reminderCount: Math.floor(Math.random() * 3)
          }
        });
      }
    }
    
    if (deliveries.length > 0) {
      await NotificationDelivery.insertMany(deliveries);
    }
    
    console.log(`✅ Seeded ${deliveries.length} notification deliveries`);
  }

  public async cleanup(): Promise<void> {
    await this.database.disconnect();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  const seeder = new DataSeeder();
  
  seeder.seed()
    .then(() => {
      console.log('\n🎉 Data seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Data seeding failed:', error);
      process.exit(1);
    })
    .finally(() => {
      seeder.cleanup();
    });
}

export default DataSeeder;
