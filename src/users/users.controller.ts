import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
  InternalServerErrorException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './schemas/user.schema';
import { JwtAuthGuard } from '../features/auth/guards/jwt-auth.guard';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('access-token')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User created successfully' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email already exists' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto): Promise<Partial<User>> {
    return this.usersService.create(createUserDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the current user profile' })
  async getCurrentUser(@Request() req): Promise<Partial<User>> {
    const userId = req.user?.id;
    this.logger.log(`Fetching profile for user ID: ${userId}`);

    if (!userId) {
      this.logger.error('User ID not found in request after JWT validation.');
      throw new InternalServerErrorException('User information not available.');
    }

    try {
      const userProfile = await this.usersService.findById(userId);
      this.logger.log(`Returning profile data for user ID ${userId}: ${JSON.stringify(userProfile)}`);
      return userProfile;
    } catch (error) {
      this.logger.error(`Error fetching profile for user ID ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to retrieve user profile.');
    }
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update user profile information excluding password and role'
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated successfully' })
  @ApiBody({
    type: UpdateProfileDto,
    description: 'User profile fields to update',
    examples: {
      example1: {
        summary: 'Standard profile update',
        description: 'A typical profile update request',
        value: {
          firstName: 'Tayaa',
          lastName: 'Doe',
          email: 'tayaa@gmail.com',
          countryCode: 'TN'
        }
      }
    }
  })
  async updateCurrentUser(@Request() req, @Body() updateProfileDto: UpdateProfileDto): Promise<Partial<User>> {
    // Handle firstName and lastName fields
    if (updateProfileDto.firstName || updateProfileDto.lastName) {
      const currentUser = await this.usersService.findById(req.user.id);
      // Use type assertion to access the name property
      const currentName = (currentUser as any).name || '';
      const nameParts = currentName.split(' ');
      const currentFirstName = nameParts[0] || '';
      const currentLastName = nameParts.slice(1).join(' ') || '';

      // Use provided values or defaults from current name
      const firstName = updateProfileDto.firstName || currentFirstName;
      const lastName = updateProfileDto.lastName || currentLastName;

      // Create the update object with the new name
      const updateData = {
        ...updateProfileDto,
        name: `${firstName} ${lastName}`.trim()
      };

      // Remove firstName and lastName as they're not in our schema
      delete updateData.firstName;
      delete updateData.lastName;

      return this.usersService.update(req.user.id, updateData);
    }

    // If no name fields were provided, just update with the raw data
    return this.usersService.update(req.user.id, updateProfileDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return all users' })
  async findAll(): Promise<Partial<User>[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user by id' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Return a user' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findOne(@Param('id') id: string): Promise<Partial<User>> {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiBody({ type: UpdateUserDto })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req
  ): Promise<Partial<User>> {
    // Only allow users to update their own profile unless they're an admin
    if (id !== req.user.id && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only update your own profile');
    }

    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'User deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req): Promise<void> {
    // Only allow users to delete their own account unless they're an admin
    if (id !== req.user.id && req.user.role !== 'admin') {
      throw new ForbiddenException('You can only delete your own account');
    }

    return this.usersService.delete(id);
  }

  @Get('currency')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the currency of the logged-in user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Returns the user\'s currency' })
  async getUserCurrency(@Request() req): Promise<{ currency: string }> {
    return this.usersService.getUserCurrency(req.user.id);
  }
}
