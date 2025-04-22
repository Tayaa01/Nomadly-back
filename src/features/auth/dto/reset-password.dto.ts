import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ example: '123456', description: '6-digit reset code sent to your email' })
    @IsString()
    @Length(6, 6)
    code: string;

    @ApiProperty({ example: 'YourNewPassword123!', description: 'The new password you want to set' })
    @IsString()
    newPassword: string;
}
