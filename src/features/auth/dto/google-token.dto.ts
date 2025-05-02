import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleTokenDto {
    @ApiProperty({
        description: 'Google ID token obtained from the client-side authentication',
        example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
    })
    @IsString()
    @IsNotEmpty()
    id_token: string;

    @ApiProperty({
        description: 'Google access token obtained from the client-side authentication (optional, depending on backend needs)',
        example: 'ya29.a0AfB_byB...',
        required: false, // Make it optional if you only need the id_token for verification
    })
    @IsString()
    @IsNotEmpty()
    access_token: string; // Keep it for now, might be useful later
}
