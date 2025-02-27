export interface Deal {
    title: string;
    description: string;
    url: string;
    price?: string;
    discount?: string;
    rating?: number;
    location: {
      address?: string;
      city?: string;
      country: string;
      coordinates?: {
        latitude?: number;
        longitude?: number;
      };
    };
    venue: {
      name: string;
      type: string;
      rating?: number;
      priceRange?: string;
      contact?: {
        phone?: string;
        website?: string;
        socialMedia?: {
          facebook?: string;
          instagram?: string;
          twitter?: string;
        };
      };
    };
    dealDetails: {
      startDate?: string;
      endDate?: string;
      terms?: string[];
      originalPrice?: string;
      discountedPrice?: string;
      discountPercentage?: number;
      availability?: string;
      redemptionInstructions?: string;
    };
    metadata: {
      lastUpdated: string;
      source: string;
      verified: boolean;
      popularity?: number;
    };
  }
  
  export interface DealAnalysis {
    recommendations: Deal[];
    discounts: string[];
    reasons: string[];
    savingsTips: string[];
    trending: {
      categories: string[];
      venues: string[];
      locations: string[];
    };
    statistics: {
      averageDiscount: number;
      totalDeals: number;
      bestValue: {
        deal: Deal;
        reason: string;
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