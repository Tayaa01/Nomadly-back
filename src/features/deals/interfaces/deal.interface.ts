export interface Deal {
    id?: string;
    title: string;
    description: string;
    url: string;
    price?: {
      current: number;
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
    country: string;
    category: string;
    specific?: string;
    radius?: number;
    latitude?: number;
    longitude?: number;
    minDiscount?: number;
    maxPrice?: number;
    sortBy?: 'discount' | 'price' | 'distance' | 'rating';
  }
  
  export interface DealAnalysis {
    recommendations: Deal[];
    discounts: string[];
    reasons: string[];
    savingsTips: string[];
    metadata?: {
      timestamp: string;
      country: string;
      category: string;
      resultsCount: number;
      averageDiscount?: number;
      nearbyStores?: number;
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