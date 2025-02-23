export interface TaxRefundRules {
  vatRate: number;
  minAmount: number;
  refundRate: number;
  process: string;
  locations: string[];
  operators?: string[];
  documentation?: string[];
  timeLimit: string;
  restrictions?: string[];
  specialStores?: string[];
  specialZones?: string[];
  refundAvailable?: boolean;  // For US
  message?: string;          // For US
  alternatives?: string[];   // For US
}

export interface TaxRefundAnalysis {
  eligible: boolean;
  country?: string;
  vatRate?: number;
  minPurchaseAmount?: number;
  potentialRefund?: number;
  process?: string;
  locations?: string[];
  operators?: string[];
  documentation?: string[];
  timeLimit?: string;
  requirements?: string[];
  tips?: string[];
  recommendedStores?: string[];
  specialShoppingZones?: string[];
  restrictions?: string[];
  message?: string;
}
