import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GeminiService } from './gemini.service';

@ApiTags('AI')
@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate content using Gemini AI' })
  @ApiResponse({ status: 200, description: 'Generated content' })
  async generate(@Body('prompt') prompt: string) {
    const response = await this.geminiService.generateResponse(prompt);
    return { response };
  }
}
