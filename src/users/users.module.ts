import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]) // Register User schema
  ],
  controllers: [UsersController], // Register UsersController
  providers: [UsersService], // Register UsersService
  exports: [UsersService] // Export UsersService to make it available in other modules
})
export class UsersModule {}
