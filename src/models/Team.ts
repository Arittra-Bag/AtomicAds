import { Schema, model } from 'mongoose';
import { ITeam } from '@/types';

const teamSchema = new Schema<ITeam>({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Team name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
teamSchema.index({ name: 1 });
teamSchema.index({ isActive: 1 });

// Virtual populate for members
teamSchema.virtual('members', {
  ref: 'User',
  localField: '_id',
  foreignField: 'teamId'
});

// Virtual for member count
teamSchema.virtual('memberCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'teamId',
  count: true
});

// Static method to find active teams
teamSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Instance method to get active members
teamSchema.methods.getActiveMembers = function() {
  return this.model('User').find({ teamId: this._id, isActive: true });
};

export const Team = model<ITeam>('Team', teamSchema);
