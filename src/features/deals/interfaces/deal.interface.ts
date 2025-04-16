export interface Deal {
  id?: string;
  title: string;
  description: string;
  url: string;
  price?: {
    current: number | null;
    original?: number;
    currency: string;
    discountPercentage?: number;
  };
  promoCode?: {
    code: string;
    description: string;
    expiryDate?: Date;
    terms?: string[];
  };
  location?: {
    name: string;
    address: string;
    city: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    openingHours?: {
      [key: string]: string;
    };
  };
  retailer: {
    name: string;
    logo?: string;
    website?: string;
    rating?: number;
    reviewCount?: number;
  };
  category: string;
  subcategory?: string;
  validUntil?: Date;
  lastVerified: Date;
  source: string;
  imageUrl?: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface DealSearchParams {
  country: string; // Keep for general context or fallback
  category: string;
  specific?: string;
  radius?: number;
  latitude?: number;
  longitude?: number;
  minDiscount?: number;
  maxPrice?: number;
  sortBy?: 'discount' | 'price' | 'distance' | 'rating';
  departureCountry?: string; // New: For travel packages
  arrivalCountry?: string;   // New: For travel packages
}

export interface DealAnalysis {
  recommendations: Deal[];
  savingsTips: string[];
  discounts: string[];
  reasons: string[];
  metadata: {
    timestamp: string;
    country: string;
    category: string;
    resultsCount: number;
    departureCountry?: string; // Add optional departure country
    arrivalCountry?: string;   // Add optional arrival country
    averageDiscount?: number;
    topRetailer?: string;
    nearbyStores?: number;
    sources?: string[];
    marketInsights?: {
      trends: string[];
      priceRange: {
        low: number;
        high: number;
        median: number;
      };
      seasonality: {
        currentPhase: string;
        impact: string;
        recommendations: string[];
      };
      competitiveAnalysis: string[];
    };
    confidence?: number;
    dataQuality?: {
      score: number;
      factors: string[];
    };
  };
}

export interface DealResponse {
  success: boolean;
  data: DealAnalysis;
  error?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}