import { Injectable, UnauthorizedException, Logger, BadRequestException, ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
import { UsersService } from '../../users/users.service';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { LoginResponse } from './interfaces/login-response.interface';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from 'src/users/schemas/user.schema';
import { join } from 'path';
import * as crypto from 'crypto';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config'; // Import ConfigService
import { OAuth2Client, TokenPayload } from 'google-auth-library'; // Import OAuth2Client and TokenPayload

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name); // Initialize logger
  private googleClient: OAuth2Client; // Add Google Client instance

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService, // Inject MailerService
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly configService: ConfigService, // Inject ConfigService
  ) {
    // Initialize Google Client
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const lowerCaseEmail = email.toLowerCase();
      const user = await this.usersService.findByEmail(lowerCaseEmail); // Use lowercase email
      if (!user) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return null;
      }

      // Explicitly select the fields we need
      const userObject = user.toObject();
      console.log('User object:', userObject); // Debug log

      return {
        _id: userObject._id,
        email: userObject.email,
        firstName: userObject.firstName,
        lastName: userObject.lastName,
        countryCode: userObject.countryCode,
        role: userObject.role
      };
    } catch (error) {
      this.logger.error('Validate user error:', error);
      return null;
    }
  }

  async login(user: any): Promise<LoginResponse> {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user data');
    }

    const payload = {
      email: user.email.toLowerCase(), // Ensure email in payload is lowercase
      sub: user._id.toString(),
      role: user.role || 'user',
      countryCode: user.countryCode // Add country code to JWT payload
    };

    console.log('Login payload:', payload); // Debug log

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email.toLowerCase(), // Ensure email in response is lowercase
        firstName: user.firstName,
        lastName: user.lastName,
        countryCode: user.countryCode,
        role: user.role || 'user'
      }
    };
  }

  async register(createUserDto: CreateUserDto): Promise<LoginResponse> {
    const newUser = await this.usersService.create(createUserDto);

    // Send welcome email asynchronously (don't wait for it)
    this.sendWelcomeEmail(newUser).catch(error => {
      this.logger.error(`Failed to send welcome email to ${newUser.email}`, error.stack);
      // Decide if you want to throw an error or just log it
      // Depending on requirements, registration might still be considered successful
    });

    // Return login response immediately
    return this.login(newUser);
  }

  async sendPasswordResetCode(email: string): Promise<void> {
    const lowerCaseEmail = email.toLowerCase();
    const user = await this.usersService.findByEmail(lowerCaseEmail); // Use lowercase email
    if (!user) return; // Don't reveal if user exists
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { passwordResetToken: code, passwordResetExpires: expires } }
    );
    await this.mailerService.sendMail({
      to: user.email, // user.email is already lowercase from findByEmail
      subject: 'Your Nomadly Password Reset Code',
      template: './reset-code',
      context: { firstName: user.firstName, code },
    });
  }

  async resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<void> {
    const lowerCaseEmail = email.toLowerCase();
    const user = await this.usersService.findByEmail(lowerCaseEmail); // Use lowercase email
    this.logger.log(`User: ${user?.email}, DB code: ${user?.passwordResetToken}, DB expires: ${user?.passwordResetExpires}, Provided code: ${code}`);
    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      this.logger.warn('User, code, or expiration missing for email: ' + lowerCaseEmail);
      throw new BadRequestException('Invalid or expired code'); // Changed to BadRequestException
    }
    if (
      user.passwordResetToken !== code ||
      user.passwordResetExpires.getTime() < Date.now()
    ) {
      this.logger.warn(`Code mismatch or expired for ${lowerCaseEmail}. Provided: ${code}, DB: ${user.passwordResetToken}, Expires: ${user.passwordResetExpires}, Now: ${new Date()}`);
      throw new BadRequestException('Invalid or expired code'); // Changed to BadRequestException
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { password: hashed }, $unset: { passwordResetToken: '', passwordResetExpires: '' } }
    );
    this.logger.log(`Password successfully reset for user: ${lowerCaseEmail}`);
  }

  async changePassword(email: string, oldPassword: string, newPassword: string): Promise<void> {
    const lowerCaseEmail = email.toLowerCase();
    const user = await this.usersService.findByEmail(lowerCaseEmail); // Use lowercase email
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Old password is incorrect');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userModel.updateOne(
      { _id: user._id },
      { $set: { password: hashed } }
    );
  }

  verifyJwt(token: string): any {
    return this.jwtService.verify(token);
  }

  async findOrCreateGoogleUser(googleUser: any): Promise<LoginResponse> {
    const lowerCaseEmail = googleUser.email.toLowerCase();
    let user: UserDocument | null = null; // Initialize user as potentially null

    try {
      user = await this.usersService.findByEmail(lowerCaseEmail);
      this.logger.log(`Existing user logging in via Google OAuth: ${lowerCaseEmail}`);
      // Optionally update user details (e.g., name) from Google profile if needed
      // await this.usersService.update(user.id, { firstName: googleUser.firstName, lastName: googleUser.lastName });

    } catch (error) {
      if (error instanceof NotFoundException) {
        // User doesn't exist, create a new one
        this.logger.log(`User not found, creating new user from Google OAuth: ${lowerCaseEmail}`);
        try {
          const newUserDto = {
            email: lowerCaseEmail,
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            isEmailVerified: true, // Email is verified by Google
            authProvider: 'google', // Mark as Google user
            // countryCode: 'US', // Set default or handle differently
            // currency: 'USD', // Set default or handle differently
          };
          user = await this.usersService.createGoogleUser(newUserDto);
          await this.sendWelcomeEmail(user); // Send welcome email
        } catch (creationError) {
          if (creationError instanceof ConflictException) {
            this.logger.error(`Conflict creating Google user, email might exist despite initial check: ${lowerCaseEmail}`, creationError.stack);
            throw creationError; // Re-throw conflict exception
          }
          this.logger.error(`Error creating user from Google OAuth: ${lowerCaseEmail}`, creationError.stack);
          throw new InternalServerErrorException('Could not create user from Google data.');
        }
      } else {
        // Handle other potential errors from findByEmail
        this.logger.error(`Error finding user by email during Google Auth: ${lowerCaseEmail}`, error.stack);
        throw error;
      }
    }

    // Ensure user is not null before proceeding
    if (!user) {
      this.logger.error(`User object is null after findOrCreateGoogleUser for email: ${lowerCaseEmail}`);
      throw new InternalServerErrorException('Failed to retrieve or create user.');
    }

    // Prepare user data for login
    const userForLogin = {
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      countryCode: user.countryCode, // Make sure this exists on the user object
      role: user.role,
    };

    return this.login(userForLogin);
  }

  async verifyGoogleTokenAndLogin(idToken: string): Promise<LoginResponse> {
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'), // Specify the CLIENT_ID of the app that accesses the backend
      });
      payload = ticket.getPayload();

      if (!payload) {
        this.logger.error('Google ID token verification failed: No payload');
        throw new UnauthorizedException('Invalid Google token');
      }

      if (!payload.email || !payload.email_verified) {
        this.logger.error('Google ID token verification failed: Email missing or not verified');
        throw new UnauthorizedException('Google account email not verified or missing');
      }

      this.logger.log(`Google ID token verified for email: ${payload.email}`);

      // Prepare user data from token payload
      const googleUserData: {
        googleId: string;
        email: string;
        firstName: string;
        lastName: string;
        isEmailVerified: boolean;
        authProvider: 'google';
      } = {
        googleId: payload.sub, // Google's unique ID for the user
        email: payload.email.toLowerCase(),
        firstName: payload.given_name || payload.email.split('@')[0], // Fallback if missing
        lastName: payload.family_name || '.', // Fallback if missing
        isEmailVerified: true, // Already checked payload.email_verified
        authProvider: 'google',
      };

      // Find or create user based on extracted data
      const user = await this.findOrCreateUserFromGoogleData(googleUserData);

      // Login the user and return JWT
      // Ensure the user object passed to login has the necessary fields
      const userForLogin = {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        countryCode: user.countryCode, // Make sure this exists on the user object
        role: user.role,
      };
      return this.login(userForLogin);

    } catch (error) {
      this.logger.error(`Google ID token verification or login failed: ${error.message}`, error.stack);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to authenticate with Google token');
    }
  }

  private async findOrCreateUserFromGoogleData(googleUserData: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    authProvider: 'google';
  }): Promise<UserDocument> {
    let user: UserDocument | null = null;

    try {
      user = await this.usersService.findByEmail(googleUserData.email);
      this.logger.log(`Existing user logging in via Google Token: ${googleUserData.email}`);
      // Optionally update user details (e.g., name, googleId) if they logged in differently before
      if (!user.googleId) {
        await this.userModel.updateOne({ _id: user._id }, { $set: { googleId: googleUserData.googleId, authProvider: 'google' } });
        user.googleId = googleUserData.googleId; // Update in-memory object
        user.authProvider = 'google';
      }

    } catch (error) {
      if (error instanceof NotFoundException) {
        // User doesn't exist, create a new one
        this.logger.log(`User not found, creating new user from Google Token: ${googleUserData.email}`);
        try {
          // Prepare DTO for user creation
          const newUserDto: Partial<CreateUserDto> & {
            googleId?: string;
            authProvider?: 'google';
            isEmailVerified?: boolean;
            countryCode?: string | null; // Allow null for countryCode
          } = {
            email: googleUserData.email,
            firstName: googleUserData.firstName,
            lastName: googleUserData.lastName,
            isEmailVerified: googleUserData.isEmailVerified,
            googleId: googleUserData.googleId,
            authProvider: googleUserData.authProvider,
            countryCode: null, // Explicitly set countryCode to null for new Google users
          };
          user = await this.usersService.createGoogleUser(newUserDto);
          await this.sendWelcomeEmail(user); // Send welcome email
        } catch (creationError) {
          if (creationError instanceof ConflictException) {
            this.logger.error(`Conflict creating Google user via token, email might exist despite initial check: ${googleUserData.email}`, creationError.stack);
            throw creationError;
          }
          this.logger.error(`Error creating user from Google Token: ${googleUserData.email}`, creationError.stack);
          throw new InternalServerErrorException('Could not create user from Google data.');
        }
      } else {
        // Handle other potential errors from findByEmail
        this.logger.error(`Error finding user by email during Google Token Auth: ${googleUserData.email}`, error.stack);
        throw error;
      }
    }

    if (!user) {
      this.logger.error(`User object is null after findOrCreateUserFromGoogleData for email: ${googleUserData.email}`);
      throw new InternalServerErrorException('Failed to retrieve or create user.');
    }

    return user;
  }

  private async sendWelcomeEmail(user: Partial<User>): Promise<void> {
    try {
      // Check if required email property exists
      if (!user.email) {
        throw new Error('User email is missing, cannot send welcome email');
      }
      const lowerCaseEmail = user.email.toLowerCase(); // Ensure email is lowercase

      this.logger.log(`Attempting to send welcome email to ${lowerCaseEmail}...`);
      this.logger.log(`Using template at ${join(process.cwd(), 'src/mail-templates/welcome.hbs')}`);

      const mailResult = await this.mailerService.sendMail({
        to: lowerCaseEmail, // Send to lowercase email
        subject: 'Welcome to Nomadly - Your Smart Travel Companion',
        template: './welcome',
        context: {
          firstName: user.firstName || 'Traveler',
        },
        headers: {
          // Removed priority headers which might negatively impact spam filters
          'X-Mailer': 'Nomadly Mailer',
          'List-Unsubscribe': `<mailto:unsubscribe@nomadly.app?subject=Unsubscribe&body=${lowerCaseEmail}>`, // Use lowercase email
        }
        // Removed unsupported attachDataUrls property
      });

      this.logger.log(`Welcome email sent successfully to ${lowerCaseEmail}`);
      this.logger.log(`Mail response: ${JSON.stringify(mailResult)}`);
    } catch (error) {
      this.logger.error(`Error sending welcome email to ${user.email?.toLowerCase() || 'unknown user'}`); // Log lowercase email on error
      this.logger.error(`Error details: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw error;
    }
  }
}
