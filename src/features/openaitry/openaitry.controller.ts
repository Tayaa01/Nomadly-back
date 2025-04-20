import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpenaitryService } from './openaitry.service';
import { TravelRequestDto, BudgetOptimizedTravelRequestDto } from './dto/travel-request.dto';
import { PlanDocument } from './schemas/plan.schema'; // Import PlanDocument if needed for response type

@ApiTags('Travel Planner')
@Controller('travel-planner')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
export class OpenaitryController {
  constructor(private readonly openaitryService: OpenaitryService) {}

  @Post('generate-plan')
  @ApiOperation({ summary: 'Generate and save a travel plan for a specific city' }) // Update summary
  @ApiBody({
    type: TravelRequestDto,
    description: 'Travel plan request with city and optional budget', // Update description
    examples: {
      example1: {
        summary: 'Paris trip example',
        value: {
          country: 'France',
          city: 'Paris', // Add city example
          budget: 1500,
          days: 5,
          startDate: '2025-06-15'
        }
      },
      example2: {
        summary: 'Tokyo budget trip', // Update example name
        value: {
          country: 'Japan',
          city: 'Tokyo', // Add city example
          budget: 2000,
          days: 7,
          startDate: '2025-09-20'
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Travel plan generated and saved', /* Consider adding schema for PlanDocument */ })
  async generatePlan(@Body() body: TravelRequestDto, @Request() req): Promise<PlanDocument> { // Use updated DTO
    // Pass the full body (including city) to the service
    return this.openaitryService.generateItinerary(body, req.user.id);
  }

  @Post('generate-budget-plan')
  @ApiOperation({ summary: 'Generate and save a budget-optimized travel plan for a specific city' }) // Update summary
  @ApiBody({
    type: BudgetOptimizedTravelRequestDto,
    description: 'Travel plan request for minimum budget in a specific city', // Update description
    examples: {
      example1: {
        summary: 'Budget Bangkok trip', // Update example name
        value: {
          country: 'Thailand',
          city: 'Bangkok', // Add city example
          days: 7,
          startDate: '2025-05-15'
        }
      },
      example2: {
        summary: 'Budget Rome weekend', // Update example name
        value: {
          country: 'Italy',
          city: 'Rome', // Add city example
          days: 3,
          startDate: '2025-07-10'
        }
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Budget-optimized travel plan generated and saved', /* Consider adding schema for PlanDocument */ })
  async generateBudgetPlan(@Body() body: BudgetOptimizedTravelRequestDto, @Request() req): Promise<PlanDocument> { // Use updated DTO
    // Pass the full body (including city) to the service
    return this.openaitryService.generateBudgetOptimizedItinerary(body, req.user.id);
  }

  @Get('plan')
  @ApiOperation({ summary: 'Get the saved travel plan for the logged-in user' })
  @ApiResponse({ status: 200, description: 'Returns the saved travel plan', /* Consider adding schema for PlanDocument */ })
  @ApiResponse({ status: 404, description: 'No travel plan found for this user' })
  async getPlan(@Request() req): Promise<PlanDocument> {
    return this.openaitryService.getUserPlan(req.user.id);
  }

  @Get('weather')
  @ApiOperation({ summary: 'Get weather forecast for a city' })
  @ApiQuery({ name: 'city', required: true, description: 'City name' })
  @ApiQuery({ name: 'date', required: false, description: 'Date in YYYY-MM-DD format' })
  @ApiResponse({
    status: 200,
    description: 'Returns weather forecast',
    schema: {
      type: 'object',
      properties: {
        forecast: { type: 'string' }
      }
    }
  })
  async getWeatherForecast(
    @Query('city') city: string,
    @Query('date') date?: string
  ): Promise<{ forecast: string }> {
    const forecast = await this.openaitryService.getWeatherForecast(city, date);
    return { forecast };
  }

  @Get('plan-weather')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get weather forecast for the saved travel plan dates' })
  @ApiResponse({
    status: 200,
    description: 'Returns weather forecasts for the travel plan dates',
    schema: {
      type: 'object',
      properties: {
        country: { type: 'string' },
        city: { type: 'string', nullable: true }, // Add city to response schema
        startDate: { type: 'string' },
        days: { type: 'number' },
        forecasts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              forecast: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'No travel plan found for this user' })
  async getPlanWeather(@Request() req) {
    const plan = await this.openaitryService.getUserPlan(req.user.id);
    const forecasts = await this.openaitryService.getPlanWeatherForecasts(plan);
    return {
      country: plan.country,
      city: plan.city, // Include city in the response
      startDate: plan.startDate,
      days: plan.days,
      forecasts
    };
  }
}