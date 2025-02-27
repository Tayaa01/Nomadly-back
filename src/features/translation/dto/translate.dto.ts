import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TranslateDto {
  @ApiProperty({
    description: 'Text to translate',
    example: 'Hello, how are you?'
  })
  text: string;

  @ApiProperty({
    description: 'Target language',
    example: 'French'
  })
  targetLanguage: string;

  @ApiPropertyOptional({
    description: 'Source language (optional)',
    example: 'English'
  })
  sourceLanguage?: string;
}
