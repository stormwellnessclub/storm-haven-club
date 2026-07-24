// Wellness service to credit type mapping
// This file provides the mapping between spa service names and their corresponding credit types

export type WellnessCreditType = 'red_light' | 'dry_cryo' | 'ozone';

// Service name patterns that match specific credit types
// The keys are substrings that can appear in service names (case-insensitive)
export const WELLNESS_SERVICE_TO_CREDIT: Record<string, WellnessCreditType> = {
  'red light': 'red_light',
  'red-light': 'red_light',
  'redlight': 'red_light',
  'infrared': 'red_light',
  'dry cryo': 'dry_cryo',
  'dry-cryo': 'dry_cryo',
  'drycryo': 'dry_cryo',
  'cryotherapy': 'dry_cryo',
  'cryo therapy': 'dry_cryo',
  'zerobody': 'dry_cryo',
  'zero body': 'dry_cryo',
  'ozone': 'ozone',
};

// Credit type display names
export const CREDIT_TYPE_DISPLAY_NAMES: Record<WellnessCreditType, string> = {
  red_light: 'Red Light Therapy',
  dry_cryo: 'Dry Cryotherapy',
  ozone: 'Ozone Sauna',
};

/**
 * Get the credit type for a wellness service based on its name
 * Returns null if the service doesn't match any credit types
 */
export function getWellnessCreditType(serviceName: string): WellnessCreditType | null {
  const lowerName = serviceName.toLowerCase();
  
  for (const [pattern, creditType] of Object.entries(WELLNESS_SERVICE_TO_CREDIT)) {
    if (lowerName.includes(pattern)) {
      return creditType;
    }
  }
  
  return null;
}

/**
 * Check if a service is eligible for credit-based booking
 */
export function isWellnessServiceCreditEligible(serviceName: string): boolean {
  return getWellnessCreditType(serviceName) !== null;
}

/**
 * Get the display name for a credit type
 */
export function getCreditTypeDisplayName(creditType: WellnessCreditType): string {
  return CREDIT_TYPE_DISPLAY_NAMES[creditType] || creditType;
}
