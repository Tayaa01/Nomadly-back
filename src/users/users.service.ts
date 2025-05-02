import { Injectable, ConflictException, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>
  ) { }

  async create(createUserDto: CreateUserDto): Promise<Partial<User>> {
    const lowerCaseEmail = createUserDto.email.toLowerCase();
    const existingUser = await this.userModel.findOne({ email: lowerCaseEmail }).exec();
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    try {
      const createdUser = new this.userModel({
        ...createUserDto,
        email: lowerCaseEmail, // Save email in lowercase
        password: hashedPassword,
      });
      const savedUser = await createdUser.save();
      return savedUser.toJSON();
    } catch (error) {
      throw new ConflictException('Error creating user');
    }
  }

  async createGoogleUser(googleUserDto: Partial<CreateUserDto> & { countryCode?: string | null }): Promise<UserDocument> {
    const lowerCaseEmail = googleUserDto.email.toLowerCase();
    const existingUser = await this.userModel.findOne({ email: lowerCaseEmail }).exec();
    if (existingUser) {
      // This case should ideally be handled in AuthService, but double-check here
      throw new ConflictException('Email already exists');
    }

    // Ensure required fields have default values if not provided by Google profile
    const userToCreate = {
      ...googleUserDto,
      email: lowerCaseEmail,
      firstName: googleUserDto.firstName || 'User', // Default if missing
      lastName: googleUserDto.lastName || '.', // Default if missing (schema requires it)
      isEmailVerified: true, // Assume Google email is verified
      authProvider: 'google', // Explicitly set authProvider
    };

    // Explicitly check required fields before saving
    if (!userToCreate.firstName || !userToCreate.lastName || !userToCreate.email) {
      console.error('Validation Error: Missing required fields before save attempt', userToCreate);
      throw new InternalServerErrorException('Missing required user information from Google profile.');
    }

    try {
      // Create user with the prepared data
      const createdUser = new this.userModel(userToCreate); // Use userToCreate which includes the default
      const savedUser = await createdUser.save();
      return savedUser;
    } catch (error) {
      // Log the detailed error
      console.error('Error creating Google user in DB:', error);
      // Check for specific Mongoose validation errors if needed
      if (error.name === 'ValidationError') {
        console.error('Validation Errors:', error.errors);
        // Provide a more specific error message to the client
        throw new BadRequestException(`User validation failed: ${error._message}`);
      }
      // Fallback for other types of errors
      throw new InternalServerErrorException('Error creating user from Google data');
    }
  }

  async findAll(): Promise<Partial<User>[]> {
    const users = await this.userModel.find().exec();
    return users.map(user => {
      const { password, ...result } = user.toObject();
      return result;
    });
  }

  async findById(id: string): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = user.toObject();
    return result;
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const lowerCaseEmail = email.toLowerCase();
    const user = await this.userModel
      .findOne({ email: lowerCaseEmail }) // Find using lowercase email
      .select('+password +passwordResetToken +passwordResetExpires') // Include password reset fields
      .exec();

    if (!user) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: Partial<CreateUserDto>): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    if (updateUserDto.email) {
      const lowerCaseEmail = updateUserDto.email.toLowerCase();
      const existingUser = await this.userModel.findOne({
        email: lowerCaseEmail, // Check using lowercase email
        _id: { $ne: id }
      }).exec();

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
      updateUserDto.email = lowerCaseEmail; // Ensure email is updated in lowercase
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = updatedUser.toObject();
    return result;
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  async deactivate(id: string): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = updatedUser.toObject();
    return result;
  }

  async activate(id: string): Promise<Partial<User>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Invalid ID format');
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { isActive: true }, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const { password, ...result } = updatedUser.toObject();
    return result;
  }

  async getUserCurrency(userId: string): Promise<{ currency: string }> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return { currency: user.currency || 'USD' }; // Return the user's currency or a default value
  }
}
