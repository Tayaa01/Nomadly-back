import { Controller, Post, Body, HttpException, HttpStatus, Query, Get } from '@nestjs/common';
import { OpenaitryService } from './openaitry.service';
import { IsNotEmpty, IsNumber, Min, Max, IsDateString } from 'class-validator';

export class TravelRequestDto {
  @IsNotEmpty({ message: 'Country is required' })
  country: string;

  @IsNumber({}, { message: 'Budget must be a number' })
  @Min(1, { message: 'Budget must be greater than 0' })
  budget: number;

  @IsNumber({}, { message: 'Days must be a number' })
  @Min(1, { message: 'Minimum stay is 1 day' })
  @Max(14, { message: 'Maximum stay is 14 days' })
  days: number;

  @IsDateString({}, { message: 'Start Date must be a valid date string' })
  startDate: string;  // Added field
}

@Controller('travel')
export class OpenaitryController {
    constructor(private openaitryService: OpenaitryService) {}
    @Get()
async getWeather(
  @Query('city') city: string,
  @Query('date') date?: string, // optional
): Promise<string> {
  if (!city) {
    return 'Please provide a city, e.g., /weather?city=London';
  }
  return await this.openaitryService.getWeatherForecast(city, date);
}
 
    @Post('itinerary')
    async generateItinerary(@Body() travelRequest: TravelRequestDto) {
        console.log('Received request:', JSON.stringify(travelRequest, null, 2));
        
        if (!travelRequest.country || !travelRequest.budget || !travelRequest.days || !travelRequest.startDate) {
            throw new HttpException({
                status: HttpStatus.BAD_REQUEST,
                error: 'Missing required fields',
                details: {
                    country: !travelRequest.country ? 'Country is required' : null,
                    budget: !travelRequest.budget ? 'Budget is required' : null,
                    days: !travelRequest.days ? 'Days is required' : null,
                    startDate: !travelRequest.startDate ? 'Start Date is required' : null,
                },
                timestamp: new Date().toISOString(),
            }, HttpStatus.BAD_REQUEST);
        }

        try {
            const startTime = new Date().toISOString();
            console.log(`Starting itinerary generation at: ${startTime}`);

            const itinerary = await this.openaitryService.generateItinerary(travelRequest);
            
            const endTime = new Date().toISOString();
            console.log(`Completed itinerary generation at: ${endTime}`);

            return {
                itinerary,
                metadata: {
                    generated_at: endTime,
                    request: {
                        country: travelRequest.country,
                        budget: travelRequest.budget,
                        days: travelRequest.days,
                        startDate: travelRequest.startDate,
                    }
                }
            };
        } catch (error) {
            console.error('Error processing request:', error);
            throw new HttpException({
                status: HttpStatus.INTERNAL_SERVER_ERROR,
                error: 'Failed to generate itinerary',
                message: error.message,
                timestamp: new Date().toISOString(),
            }, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}