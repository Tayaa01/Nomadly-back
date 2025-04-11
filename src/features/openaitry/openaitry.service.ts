import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface TravelRequest {
  country: string;
  budget: number;
  days: number;
  startDate: string;  // Added field
}

@Injectable()
export class OpenaitryService {
    private readonly logger = new Logger(OpenaitryService.name);
    private genAI: GoogleGenerativeAI;
    private weatherApiKey = '8c73beaa1cca73a2ac04160f9ff053cb';

    constructor() {
        this.genAI = new GoogleGenerativeAI("AIzaSyAAYyncXO3aGasxg8Jl1DaP7uqsNLYNw8k");
        this.logger.log('OpenaitryService initialized with current timestamp: ' + new Date().toISOString());
    }
    async getWeatherForecast(city: string, date?: string): Promise<string> {
        const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${this.weatherApiKey}&units=metric`;
      
        try {
          const response = await axios.get(url);
          const forecasts = response.data.list;
      
          let filteredForecasts = forecasts;
      
          // If a specific date is provided, filter forecasts for that date
          if (date) {
            filteredForecasts = forecasts.filter(forecast =>
              forecast.dt_txt.startsWith(date) // e.g., "2025-04-13"
            );
          } else {
            filteredForecasts = forecasts.slice(0, 5); // Default to next 5 intervals
          }
      
          if (filteredForecasts.length === 0) {
            return `No weather data available for ${city} on ${date}.`;
          }
      
          let forecastSummary = `Weather forecast for ${city}`;
          if (date) forecastSummary += ` on ${date}`;
          forecastSummary += `:\n`;
      
          filteredForecasts.forEach(forecast => {
            const time = forecast.dt_txt;
            const temp = forecast.main.temp;
            const desc = forecast.weather[0].description;
            forecastSummary += `- ${time}: ${temp}°C, ${desc}\n`;
          });
      
          return forecastSummary;
      
        } catch (error) {
          this.logger.error('Error fetching weather data:', error.message);
          return 'Weather information unavailable.';
        }
      }
    async generateItinerary(travelRequest: TravelRequest): Promise<string> {
        const startTime = new Date().toISOString();
        this.logger.log(`Starting itinerary generation at ${startTime} for ${travelRequest.country}`);

        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            
            const prompt = this.buildPrompt(travelRequest);
            this.logger.log('Generated prompt for AI model');

            const result = await model.generateContent(prompt);
            const response = result.response.text();

            const endTime = new Date().toISOString();
            this.logger.log(`Completed itinerary generation at ${endTime}`);

            if (!response) {
                throw new Error('No response generated from AI model');
            }

            // Validate the response format
            if (!this.isValidItinerary(response)) {
                throw new Error('Generated itinerary format is invalid');
            }

            return response;

        } catch (error) {
            this.logger.error('Error generating itinerary:', error);
            throw new Error(`Failed to generate itinerary: ${error.message}`);
        }
    }

    private buildPrompt(travelRequest: TravelRequest): string {
        return `Create a detailed daily travel itinerary table for ${travelRequest.days} days in ${travelRequest.country} with a total budget of $${travelRequest.budget} starting from ${travelRequest.startDate}.

        Requirements:
        1. Format the response in a clean markdown table
        2. Include these columns: Day, Morning, Afternoon, Evening, Daily Cost
        3. Ensure the total cost across all days fits within the budget of $${travelRequest.budget}
        4. Include specific locations, attractions, and restaurants
        5. Consider local transportation costs
        6. Include meal recommendations
        7. Add cost estimates for each day
        8. Consider local customs and peak tourist times
        
        Extra tips:
        - Suggest free activities when possible to help with budget
        - Include local transportation options and costs
        - Mention best times to visit specific attractions
        - Include budget-saving tips
        
        Please format the table header as:
        | Day | Morning | Afternoon | Evening | Daily Cost |

        Additional Requirements:
        - Currency: USD
        - Format costs as: $X
        - Include transportation between locations
        - Specify opening hours when relevant
        - List alternative options for bad weather
        - Include local emergency contacts
        
        Current UTC DateTime: ${new Date().toISOString()}`;
    }

    private isValidItinerary(response: string): boolean {
        // Basic validation of the markdown table format
        const lines = response.split('\n');
        const hasHeader = lines.some(line => 
            line.includes('| Day | Morning | Afternoon | Evening | Daily Cost |'));
        const hasContent = lines.some(line => 
            line.trim().startsWith('|') && line.trim().endsWith('|'));

        return hasHeader && hasContent;
    }
}