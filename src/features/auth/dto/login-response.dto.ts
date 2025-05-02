import { ApiProperty } from '@nestjs/swagger';

// Define a simple User DTO for the response structure
class UserResponseDto {
    @ApiProperty({ example: '67c42ba15ee096beea501d7c' })
    id: string;

    @ApiProperty({ example: 'tayaa@gmail.com' })
    email: string;

    @ApiProperty({ example: 'Tayaa' })
    firstName: string;

    @ApiProperty({ example: 'Doe' })
    lastName: string;

    @ApiProperty({ example: 'TN' })
    countryCode: string;

    @ApiProperty({ example: 'user' })
    role: string;
}

export class LoginResponseDto {
    @ApiProperty({
        description: 'JWT access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    access_token: string;

    @ApiProperty({ description: 'User details', type: UserResponseDto })
    user: UserResponseDto;
}
