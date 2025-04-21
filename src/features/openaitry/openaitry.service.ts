import { GoogleGenerativeAI } from '@google/generative-ai';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { Plan, PlanDocument } from './schemas/plan.schema';

interface TravelRequest {
  country: string;
  city: string; // Add city
  budget?: number; // Make budget optional here too
  days: number;
  startDate: string;
}

interface BudgetOptimizedTravelRequest {
  country: string;
  city: string; // Add city
  days: number;
  startDate: string;
}

// Update interface to remove title
interface ItineraryDay {
  content: string;
}

interface StructuredItinerary {
  days: ItineraryDay[];
  additionalInfo?: string;
}

@Injectable()
export class OpenaitryService {
  private readonly logger = new Logger(OpenaitryService.name);
  private genAI: GoogleGenerativeAI;
  private weatherApiKey = '8c73beaa1cca73a2ac04160f9ff053cb';

  private readonly cityMap = {
    'France': 'Paris',
    'Italy': 'Rome',
    'Spain': 'Madrid',
    'Germany': 'Berlin',
    'UK': 'London',
    'United Kingdom': 'London',
    'Japan': 'Tokyo',
    'China': 'Beijing',
    'USA': 'New York',
    'United States': 'New York',
    'Canada': 'Toronto',
    'Australia': 'Sydney',
    'Thailand': 'Bangkok',
    'Vietnam': 'Hanoi',
    'Indonesia': 'Jakarta',
    'Brazil': 'Rio de Janeiro',
    'Mexico': 'Mexico City',
    'India': 'New Delhi',
    'South Korea': 'Seoul',
    'Russia': 'Moscow',
  };

  constructor(
    @InjectModel(Plan.name) private readonly planModel: Model<PlanDocument>
  ) {
    this.genAI = new GoogleGenerativeAI("AIzaSyAAYyncXO3aGasxg8Jl1DaP7uqsNLYNw8k");
    this.logger.log('OpenaitryService initialized with current timestamp: ' + new Date().toISOString());
  }

  async getWeatherForecast(city: string, date?: string): Promise<string> {
    try {
      // First, check if we're looking for current weather or forecast
      const isCurrentWeather = !date || this.isDateWithinRange(date, 5);

      if (isCurrentWeather) {
        // Get current weather or near-term forecast (next 5 days)
        return this.getCurrentWeather(city, date);
      } else {
        // For dates beyond the 5-day forecast, provide historical averages or climate data
        return this.getClimateData(city, date);
      }
    } catch (error) {
      this.logger.error(`Error fetching weather data: ${error.message}`);
      return 'Weather information unavailable. Please try again later.';
    }
  }

  private async getCurrentWeather(city: string, date?: string): Promise<string> {
    // API endpoint for the 5-day forecast
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${this.weatherApiKey}&units=metric`;

    try {
      const response = await axios.get(url);
      const forecasts = response.data.list;
      const cityName = response.data.city.name; // Get the proper city name from the API

      // If no specific date is provided, return current weather
      if (!date) {
        // Get current weather
        const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${this.weatherApiKey}&units=metric`;
        const currentResponse = await axios.get(currentWeatherUrl);

        const temp = currentResponse.data.main.temp;
        const desc = currentResponse.data.weather[0].description;
        const humidity = currentResponse.data.main.humidity;
        const windSpeed = currentResponse.data.wind.speed;

        return `Current weather in ${cityName}:\n` +
          `- Temperature: ${temp}°C\n` +
          `- Conditions: ${desc}\n` +
          `- Humidity: ${humidity}%\n` +
          `- Wind Speed: ${windSpeed} m/s`;
      }

      // If date is provided and within 5 days, filter forecasts for that date
      const filteredForecasts = forecasts.filter(forecast =>
        forecast.dt_txt.startsWith(date)
      );

      if (filteredForecasts.length === 0) {
        return `No weather forecast available for ${cityName} on ${date}. Forecasts are only available for the next 5 days.`;
      }

      let forecastSummary = `Weather forecast for ${cityName} on ${date}:\n`;
      filteredForecasts.forEach(forecast => {
        const time = forecast.dt_txt.split(' ')[1].substring(0, 5); // Extract just HH:MM
        const temp = forecast.main.temp;
        const desc = forecast.weather[0].description;
        forecastSummary += `- ${time}: ${temp}°C, ${desc}\n`;
      });

      return forecastSummary;

    } catch (error) {
      // Handle city not found errors specially
      if (error.response && error.response.status === 404) {
        return `City "${city}" not found. Please check the spelling and try again.`;
      }
      throw error;
    }
  }

  private async getClimateData(city: string, date: string): Promise<string> {
    // Extract month from the date string
    const targetDate = new Date(date);
    const month = targetDate.getMonth();
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(targetDate);

    // More accurate climate data for popular tourist destinations
    const climateByCityAndMonth = {
      // Each city has an array of 12 months [Jan, Feb, Mar...]
      "Bangkok": {
        temps: [27, 28, 30, 31, 31, 30, 30, 30, 29, 29, 28, 26],
        conditions: [
          "warm and dry", "warm and dry", "hot and dry",
          "very hot", "hot and rainy", "hot and rainy",
          "hot and rainy", "hot and rainy", "warm and rainy",
          "warm and rainy", "warm with occasional rain", "warm and dry"
        ],
        rainfall: ["low", "low", "low", "medium", "high", "high", "high", "high", "very high", "high", "medium", "low"]
      },
      "Paris": {
        temps: [5, 5, 8, 11, 15, 18, 20, 20, 17, 13, 8, 5],
        conditions: [
          "cold and damp", "cold and damp", "cool and showery",
          "mild with showers", "mild with occasional rain", "warm with occasional showers",
          "warm and mostly sunny", "warm and mostly sunny", "mild with occasional rain",
          "cool with occasional rain", "cold with occasional rain", "cold and damp"
        ],
        rainfall: ["medium", "medium", "medium", "medium", "medium", "low", "low", "low", "medium", "medium", "medium", "medium"]
      },
      "Rome": {
        temps: [8, 9, 11, 14, 18, 22, 25, 25, 22, 17, 13, 9],
        conditions: [
          "cool and rainy", "cool and rainy", "mild with showers",
          "mild and pleasant", "warm and sunny", "hot and sunny",
          "hot and dry", "hot and dry", "warm and pleasant",
          "mild with occasional rain", "mild with rain", "cool and rainy"
        ],
        rainfall: ["high", "medium", "medium", "medium", "low", "low", "very low", "very low", "low", "medium", "high", "high"]
      },
      "Tokyo": {
        temps: [6, 6, 9, 14, 19, 22, 26, 27, 23, 18, 13, 8],
        conditions: [
          "cold and sunny", "cold and sunny", "cool with occasional rain",
          "mild with occasional rain", "warm with occasional rain", "warm and rainy",
          "hot, humid and rainy", "hot, humid and rainy", "warm with occasional typhoons",
          "mild and pleasant", "cool and mostly sunny", "cold and sunny"
        ],
        rainfall: ["low", "low", "medium", "medium", "medium", "high", "high", "high", "high", "medium", "medium", "low"]
      },
      "New York": {
        temps: [0, 1, 6, 12, 18, 23, 26, 25, 21, 15, 9, 3],
        conditions: [
          "very cold, possible snow", "very cold, possible snow", "cool with occasional rain",
          "mild with showers", "warm with occasional rain", "warm and humid",
          "hot and humid", "hot and humid", "warm and pleasant",
          "mild and pleasant", "cool with occasional rain", "cold, possible snow"
        ],
        rainfall: ["medium", "medium", "medium", "medium", "medium", "medium", "medium", "medium", "medium", "low", "medium", "medium"]
      },
      "London": {
        temps: [5, 5, 7, 9, 13, 16, 18, 18, 16, 12, 8, 6],
        conditions: [
          "cold and rainy", "cold and rainy", "cool and rainy",
          "cool with showers", "mild with showers", "mild with occasional rain",
          "warm with occasional rain", "warm with occasional rain", "mild with occasional rain",
          "cool and rainy", "cold and rainy", "cold and rainy"
        ],
        rainfall: ["high", "high", "high", "medium", "medium", "medium", "medium", "medium", "medium", "high", "high", "high"]
      },
      "Sydney": {
        temps: [23, 23, 22, 19, 16, 14, 13, 14, 16, 18, 20, 22], // Southern hemisphere seasons
        conditions: [
          "warm and humid", "warm and humid", "warm and pleasant",
          "mild and pleasant", "cool with occasional rain", "cool and rainy",
          "cool and rainy", "cool with occasional rain", "mild with occasional rain",
          "mild and pleasant", "warm and pleasant", "warm and humid"
        ],
        rainfall: ["medium", "high", "high", "medium", "medium", "high", "medium", "medium", "medium", "medium", "medium", "medium"]
      },
      "Dubai": {
        temps: [19, 20, 23, 27, 31, 33, 35, 36, 33, 29, 25, 21],
        conditions: [
          "mild and sunny", "mild and sunny", "warm and sunny",
          "hot and sunny", "very hot and sunny", "extremely hot and sunny",
          "extremely hot and humid", "extremely hot and humid", "very hot and sunny",
          "hot and sunny", "warm and sunny", "mild and sunny"
        ],
        rainfall: ["very low", "very low", "very low", "very low", "very low", "none", "none", "very low", "none", "none", "very low", "very low"]
      },
      "Rio de Janeiro": {
        temps: [30, 30, 29, 27, 25, 24, 23, 24, 24, 25, 27, 28], // Southern hemisphere seasons
        conditions: [
          "hot and humid", "hot and humid", "hot and rainy",
          "warm and pleasant", "mild and pleasant", "mild and mostly sunny",
          "mild and mostly sunny", "mild and mostly sunny", "warm and mostly sunny",
          "warm and mostly sunny", "warm and occasional showers", "hot and humid"
        ],
        rainfall: ["high", "high", "high", "medium", "medium", "low", "low", "low", "medium", "medium", "medium", "high"]
      }
    };

    // If we don't have data for this city, try to map it to a nearby city or use regional data
    const cityMapping = {
      "Phuket": "Bangkok",
      "Chiang Mai": "Bangkok",
      "Pattaya": "Bangkok",
      "Milan": "Rome",
      "Florence": "Rome",
      "Venice": "Rome",
      "Naples": "Rome",
      "Osaka": "Tokyo",
      "Kyoto": "Tokyo",
      "Hokkaido": "Tokyo",
      "Brooklyn": "New York",
      "Manhattan": "New York",
      "Queens": "New York",
      "Liverpool": "London",
      "Manchester": "London",
      "Birmingham": "London",
      // Add more mappings as needed
    };

    // Try to find the city or a mapped equivalent
    const mappedCity = cityMapping[city] || city;
    const cityData = climateByCityAndMonth[mappedCity];

    // If we still don't have data, use regional defaults based on continent/region
    const defaultData = {
      temps: [15, 15, 15, 20, 25, 25, 25, 25, 20, 15, 15, 15],
      conditions: Array(12).fill("varies by location"),
      rainfall: Array(12).fill("varies by location")
    };

    // Get the climate data for this month
    const data = cityData || defaultData;
    const temp = data.temps[month];
    const condition = data.conditions[month];
    const rainfall = data.rainfall[month];

    // For really accurate forecasts, we could add special event-based info:
    const specialEvents = {
      "Bangkok": {
        4: "Note: This is during Songkran (Thai New Year) when water festivals occur throughout the country.",
        10: "Note: This is during the Vegetarian Festival with special events and food."
      },
      "Rio de Janeiro": {
        1: "Note: This may coincide with Rio Carnival, one of the world's largest festivals."
      }
      // Add more special events by city and month (0-11)
    };

    // Check if there's a special event for this city and month
    const specialEvent = cityData && specialEvents[mappedCity] && specialEvents[mappedCity][month]
      ? `\n\n${specialEvents[mappedCity][month]}`
      : '';

    return `Historical weather averages for ${city} in ${monthName} (${date}):\n\n` +
      `- Average temperature: ${temp}°C\n` +
      `- Typical conditions: ${condition}\n` +
      `- Rainfall: ${rainfall}${specialEvent}\n\n` +
      `Note: This is based on historical averages. Actual weather may vary. Precise forecasts are only available for the next 5 days.`;
  }

  private isDateWithinRange(dateStr: string, daysRange: number): boolean {
    const targetDate = new Date(dateStr);
    const currentDate = new Date();

    // Reset time to compare just the dates
    targetDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    // Calculate the difference in days
    const diffTime = targetDate.getTime() - currentDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    // Check if the date is within range
    return diffDays >= 0 && diffDays <= daysRange;
  }

  async saveOrUpdatePlan(userId: string, planData: Partial<Plan>): Promise<PlanDocument> {
    const existingPlan = await this.planModel.findOne({ userId: new Types.ObjectId(userId) });

    if (existingPlan) {
      this.logger.log(`Updating existing plan for user: ${userId}`);
      // Ensure city is updated if provided
      Object.assign(existingPlan, planData);
      return existingPlan.save();
    } else {
      this.logger.log(`Creating new plan for user: ${userId}`);
      const newPlan = new this.planModel({ userId: new Types.ObjectId(userId), ...planData });
      return newPlan.save();
    }
  }

  async getUserPlan(userId: string): Promise<PlanDocument> {
    const plan = await this.planModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!plan) {
      throw new NotFoundException('No travel plan found for this user');
    }
    return plan;
  }

  async generateItinerary(travelRequest: TravelRequest, userId: string): Promise<PlanDocument> {
    const startTime = new Date().toISOString();
    this.logger.log(`Starting itinerary generation at ${startTime} for ${travelRequest.city}, ${travelRequest.country}`); // Log city

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = this.buildPrompt(travelRequest, 'USD'); // Pass full request with city
      this.logger.log('Generated prompt for AI model');

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const endTime = new Date().toISOString();
      this.logger.log(`Completed itinerary generation at ${endTime}`);

      if (!response) {
        throw new Error('No response generated from AI model');
      }

      // Parse the response into structured daily itineraries
      const itinerary = this.parseItineraryResponse(response);

      // Save to database
      const planData: Partial<Plan> = { // Use Partial<Plan>
        country: travelRequest.country,
        city: travelRequest.city, // Save city
        days: travelRequest.days,
        startDate: travelRequest.startDate,
        budget: travelRequest.budget, // Save budget if provided
        daysContent: itinerary.days,
        additionalInfo: itinerary.additionalInfo,
        isBudgetOptimized: false
      };

      return this.saveOrUpdatePlan(userId, planData);
    } catch (error) {
      this.logger.error('Error generating itinerary:', error);
      throw new Error(`Failed to generate itinerary: ${error.message}`);
    }
  }

  async generateBudgetOptimizedItinerary(
    travelRequest: BudgetOptimizedTravelRequest,
    userId: string
  ): Promise<PlanDocument> {
    const startTime = new Date().toISOString();
    this.logger.log(`Starting budget-optimized itinerary generation at ${startTime} for ${travelRequest.city}, ${travelRequest.country}`); // Log city

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = this.buildBudgetOptimizedPrompt(travelRequest, 'USD'); // Pass full request with city
      this.logger.log('Generated budget-optimized prompt for AI model');

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const endTime = new Date().toISOString();
      this.logger.log(`Completed budget-optimized itinerary generation at ${endTime}`);

      if (!response) {
        throw new Error('No response generated from AI model');
      }

      // Extract the estimated budget from the response
      const budgetMatch = response.match(/Total Estimated Budget:\s*\$(\d+(?:\.\d+)?)/i);
      const estimatedBudget = budgetMatch ? parseFloat(budgetMatch[1]) : 0;

      // Parse the response into structured daily itineraries
      const itinerary = this.parseItineraryResponse(response);

      // Save to database
      const planData: Partial<Plan> = { // Use Partial<Plan>
        country: travelRequest.country,
        city: travelRequest.city, // Save city
        days: travelRequest.days,
        startDate: travelRequest.startDate,
        estimatedBudget: estimatedBudget,
        daysContent: itinerary.days,
        additionalInfo: itinerary.additionalInfo,
        isBudgetOptimized: true
      };

      return this.saveOrUpdatePlan(userId, planData);
    } catch (error) {
      this.logger.error('Error generating budget-optimized itinerary:', error);
      throw new Error(`Failed to generate budget-optimized itinerary: ${error.message}`);
    }
  }

  private buildPrompt(travelRequest: TravelRequest, localCurrency: string): string {
    const budgetInstruction = travelRequest.budget
      ? `The user has a guideline budget of $${travelRequest.budget} USD. Please keep the total estimated cost roughly equivalent to this, but show all costs in the local currency (${localCurrency}).`
      : `Estimate costs reasonably for a standard trip, showing all costs in the local currency (${localCurrency}).`;

    return `Create a detailed and busy daily travel itinerary table for ${travelRequest.days} days in ${travelRequest.city}, ${travelRequest.country} starting from ${travelRequest.startDate}. ${budgetInstruction}

    Requirements:
    1. Format the response in a clean markdown format.
    2. Focus activities and locations specifically within ${travelRequest.city}.
    3. FOR EACH DAY:
       - Create a clear heading: "## Day X: [Short title]".
       - Create a markdown table: | Time | Activity | Location | Cost (${localCurrency}) |.
       - Include 4-5 activities per day (morning, afternoon, evening, nightlife).
       - Include nightlife options suitable for ${travelRequest.city}.
    4. Include specific locations, attractions, restaurants, and nightlife venues.
    5. Consider local transportation costs within ${travelRequest.city}.
    6. Include meal recommendations (breakfast, lunch, dinner).
    7. Add cost estimates for each activity in ${localCurrency}. Include potential cover charges or drink prices for nightlife in ${localCurrency}.

    Extra tips:
    - Suggest free activities.
    - Include local transportation options and costs in ${localCurrency}.
    - Mention best times to visit attractions.
    - Include budget-saving tips relevant to ${travelRequest.city}.

    Additional Requirements:
    - Currency for all costs: ${localCurrency}.
    - Format costs clearly (e.g., using the ${localCurrency} code or symbol).
    - Include transportation between locations.
    - Specify opening hours.
    - After all days, include "## Additional Information" with:
      - Total trip cost summary (estimated in ${localCurrency}).
      - Local emergency contacts.
      - Weather considerations.
      - Cultural tips (including nightlife etiquette).

    Current UTC DateTime: ${new Date().toISOString()}`;
  }

  private buildBudgetOptimizedPrompt(travelRequest: BudgetOptimizedTravelRequest, localCurrency: string): string {
    return `Create a detailed and busy daily travel itinerary for ${travelRequest.days} days in ${travelRequest.city}, ${travelRequest.country} starting from ${travelRequest.startDate}, optimized for the MINIMUM POSSIBLE BUDGET. Show all costs in the local currency (${localCurrency}).

    Requirements:
    1. Format the response in clean markdown.
    2. Focus activities/locations within ${travelRequest.city}.
    3. FOR EACH DAY:
       - Heading: "## Day X: [Short title]".
       - Markdown table: | Time | Activity | Location | Cost (${localCurrency}) |.
       - Include 4-5 activities per day (morning, afternoon, evening, nightlife).
       - Include low-cost/free nightlife options.
    4. Optimize for the LOWEST POSSIBLE BUDGET in ${localCurrency}.
    5. Include specific locations, attractions, restaurants, nightlife.
    6. Focus on free/low-cost activities and budget accommodations.
    7. Include affordable meal recommendations (street food, markets).

    Budget-saving tips:
    - Prioritize free activities.
    - Suggest affordable local transport (including late-night).
    - Recommend budget food/drink options (happy hours).
    - Suggest economical accommodation (hostels).

    Additional Requirements:
    - Currency for all costs: ${localCurrency}.
    - Format costs clearly.
    - Include transportation.
    - After all days, include "## Budget Summary" with:
      - Total trip cost breakdown by category (accommodation, food, activities, transport, nightlife) in ${localCurrency}.
      - Daily average cost in ${localCurrency}.
      - Money-saving tips for ${travelRequest.city}.
      - IMPORTANT: Include "Total Estimated Budget: [Amount] ${localCurrency}" with the sum of all daily costs.

    Current UTC DateTime: ${new Date().toISOString()}`;
  }

  private parseItineraryResponse(response: string): StructuredItinerary {
    // Split the response by day headers
    const dayRegex = /## Day \d+[^#]+?(?=## Day \d+|## Additional Information|## Budget Summary|$)/gs;
    const dayMatches = [...response.matchAll(dayRegex)];

    // Simplified days mapping - only include content field
    const days: ItineraryDay[] = dayMatches.map(match => {
      const dayContent = match[0].trim();
      return { content: dayContent };
    });

    // Extract additional information if present
    let additionalInfo = '';
    const additionalInfoMatch = response.match(/## (Additional Information|Budget Summary)[^#]+/s);
    if (additionalInfoMatch) {
      additionalInfo = additionalInfoMatch[0].trim();
    }

    return {
      days,
      additionalInfo: additionalInfo || undefined
    };
  }

  async getPlanWeatherForecasts(plan: PlanDocument): Promise<{ date: string, forecast: string }[]> {
    const startDate = new Date(plan.startDate);
    const forecasts = [];

    // Use the specific city from the plan if available, otherwise fallback logic
    const city = plan.city || this.cityMap[plan.country] || plan.country; // Prioritize plan.city

    // Get forecasts for each day of the trip
    for (let i = 0; i < plan.days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      // Format the date as YYYY-MM-DD
      const dateString = currentDate.toISOString().split('T')[0];

      // Get the forecast for this day
      const forecast = await this.getWeatherForecast(city, dateString);

      forecasts.push({
        date: dateString,
        forecast
      });
    }

    return forecasts;
  }
}