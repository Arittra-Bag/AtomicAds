import { Request, Response } from 'express';
import { User } from '@/models';
import { generateToken } from '@/middleware/auth';
import { asyncHandler, createSuccessResponse, AuthenticationError, ValidationError } from '@/middleware/errorHandler';

export class AuthController {
  // User registration
  public register = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, role = 'user', teamId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Create new user
    const userData: any = { name, email, password, role };
    if (teamId) {
      userData.teamId = teamId;
    }

    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id.toString());

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(201).json(createSuccessResponse(
      {
        user: userResponse,
        token
      },
      'User registered successfully'
    ));
  });

  // User login
  public login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password').populate('teamId', 'name');
    
    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate token
    const token = generateToken(user._id.toString());

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.json(createSuccessResponse(
      {
        user: userResponse,
        token
      },
      'Login successful'
    ));
  });

  // Get current user (requires authentication)
  public getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    const user = await User.findById(userId)
      .select('-password')
      .populate('teamId', 'name description');

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    res.json(createSuccessResponse(
      user,
      'Current user retrieved successfully'
    ));
  });

  // Logout (client-side token removal)
  public logout = asyncHandler(async (req: Request, res: Response) => {
    // In a stateless JWT implementation, logout is handled client-side
    // The client should remove the token from storage
    // Here we just send a success response
    
    res.json(createSuccessResponse(
      null,
      'Logout successful'
    ));
  });

  // Refresh token (extend session)
  public refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    // Verify user still exists and is active
    const user = await User.findById(userId).select('-password');
    
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Generate new token
    const token = generateToken(user._id.toString());

    res.json(createSuccessResponse(
      {
        token,
        user
      },
      'Token refreshed successfully'
    ));
  });

  // Change password
  public changePassword = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      throw new AuthenticationError('User not authenticated');
    }

    // Find user with password
    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json(createSuccessResponse(
      null,
      'Password changed successfully'
    ));
  });

  // Admin: Create user account
  public createUser = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, role = 'user', teamId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Create new user
    const userData: any = { name, email, password, role };
    if (teamId) {
      userData.teamId = teamId;
    }

    const user = new User(userData);
    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.status(201).json(createSuccessResponse(
      userResponse,
      'User created successfully'
    ));
  });

  // Admin: Update user
  public updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, email, role, teamId, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new ValidationError('Email is already taken');
      }
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (teamId !== undefined) user.teamId = teamId;
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    // Remove password from response
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    res.json(createSuccessResponse(
      userResponse,
      'User updated successfully'
    ));
  });

  // Admin: Deactivate user
  public deactivateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new ValidationError('User not found');
    }

    res.json(createSuccessResponse(
      user,
      'User deactivated successfully'
    ));
  });

  // Admin: Reactivate user
  public reactivateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new ValidationError('User not found');
    }

    res.json(createSuccessResponse(
      user,
      'User reactivated successfully'
    ));
  });

  // Validate token (used for token verification)
  public validateToken = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new AuthenticationError('Invalid token');
    }

    const user = await User.findById(userId)
      .select('-password')
      .populate('teamId', 'name');

    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    res.json(createSuccessResponse(
      {
        valid: true,
        user
      },
      'Token is valid'
    ));
  });
}
