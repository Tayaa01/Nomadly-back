import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ example: 'OldPassword123!', description: 'Current password' })
    @IsString()
    oldPassword: string;

    @ApiProperty({ example: 'NewPassword2025!', description: 'New password' })
    @IsString()
    @MinLength(6)
    newPassword: string;
}
