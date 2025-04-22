import { Injectable, UnauthorizedException, Logger, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name); // Initialize logger

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService, // Inject MailerService
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) { }

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
