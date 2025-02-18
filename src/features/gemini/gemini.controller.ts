import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GeminiService } from './gemini.service';

@ApiTags('gemini')
@Controller('gemini')
export class GeminiController {
  constructor(private readonly geminiService: GeminiService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate AI response' })
  async generateResponse(@Body('prompt') prompt: string) {
    return this.geminiService.generateResponse(prompt);
  }
}
