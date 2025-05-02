import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_, ret) => {
      delete ret.password;
      delete ret.__v;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ type: String, required: false }) // Make password optional
  password?: string;

  @Prop({ default: 'user' })
  role: string;

  @Prop({ maxlength: 3, required: false }) // Make optional, remove minlength
  countryCode?: string;

  @Prop({ default: 'USD' }) // Add currency field with a default value
  currency: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ select: false })
  passwordResetToken?: string;

  @Prop({ select: false })
  passwordResetExpires?: Date;

  @Prop({ default: 0 })
  loginAttempts: number;

  @Prop()
  lockUntil?: Date;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop()
  lastLogin?: Date;

  @Prop({ type: String, index: true, sparse: true, unique: true, required: false }) // Add googleId field
  googleId?: string;

  @Prop({ default: 'local' }) // Add authProvider field (optional but recommended)
  authProvider?: 'local' | 'google';
}

export type UserDocument = User & Document;
export const UserSchema = SchemaFactory.createForClass(User);
