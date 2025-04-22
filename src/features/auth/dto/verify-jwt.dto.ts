import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyJwtDto {
    @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', description: 'JWT to verify' })
    @IsString()
    jwt: string;
}
