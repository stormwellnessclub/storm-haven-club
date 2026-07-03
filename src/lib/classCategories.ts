// Category mapping utilities for class passes and bookings
// This file provides a single source of truth for category translations across the entire system

// Database class_type categories
export type DatabaseClassCategory = 'pilates_cycling' | 'other' | 'aerobics';

// Pass categories stored in class_passes table
export type PassCategory = 'reformer' | 'cycling' | 'aerobics' | 'pilates_cycling' | 'other';

// Frontend purchase categories (used in ClassPasses.tsx and Stripe metadata)
export type FrontendPurchaseCategory = 'pilatesCycling' | 'otherClasses';

// Database category -> Display name
export const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'pilates_cycling': 'Class Pass',
  'reformer': 'Reformer Pilates',
  'cycling': 'Cycling',
  'aerobics': 'Aerobics',
  'other': 'Aerobics',
};

// Pass category -> Valid class categories (what classes can this pass be used for)
// All class-credit types are interchangeable across pilates/cycling and aerobics.
export const PASS_TO_CLASS_MAPPING: Record<string, string[]> = {
  'reformer': ['pilates_cycling', 'other', 'aerobics'],
  'cycling': ['pilates_cycling', 'other', 'aerobics'],
  'pilates_cycling': ['pilates_cycling', 'other', 'aerobics'],
  'aerobics': ['pilates_cycling', 'other', 'aerobics'],
  'other': ['pilates_cycling', 'other', 'aerobics'],
};

// Class category -> Valid pass categories (what passes are accepted for this class)
export const CLASS_TO_PASS_MAPPING: Record<string, string[]> = {
  'pilates_cycling': ['reformer', 'cycling', 'pilates_cycling', 'aerobics', 'other'],
  'other': ['reformer', 'cycling', 'pilates_cycling', 'aerobics', 'other'],
  'aerobics': ['reformer', 'cycling', 'pilates_cycling', 'aerobics', 'other'],
};


// Frontend purchase category -> Database pass category mapping
export const PURCHASE_TO_DB_CATEGORY: Record<FrontendPurchaseCategory, PassCategory> = {
  'pilatesCycling': 'pilates_cycling',
  'otherClasses': 'aerobics',
};

/**
 * Get valid pass categories for a given class category
 * Used when booking a class to determine which passes can be used
 */
export function getValidPassCategories(classCategory: string): string[] {
  return CLASS_TO_PASS_MAPPING[classCategory] || [classCategory];
}

/**
 * Check if a pass is valid for a given class
 * Returns true if the pass category is accepted for the class category
 */
export function isPassValidForClass(passCategory: string, classCategory: string): boolean {
  const validPasses = getValidPassCategories(classCategory);
  return validPasses.includes(passCategory);
}

/**
 * Get the display name for a category
 */
export function getCategoryDisplayName(category: string): string {
  return CATEGORY_DISPLAY_NAMES[category] || category;
}

/**
 * Normalize a category string for consistent comparison
 * Handles various formats: pilatesCycling -> pilates_cycling, etc.
 */
export function normalizeCategory(category: string): string {
  // Convert camelCase to snake_case
  const snakeCase = category.replace(/([A-Z])/g, '_$1').toLowerCase();
  
  // Map known aliases
  const aliases: Record<string, string> = {
    'pilates_cycling': 'pilates_cycling',
    'reformer': 'reformer',
    'cycling': 'cycling',
    'aerobics': 'aerobics',
    'other_classes': 'other',
    'other': 'other',
  };
  
  return aliases[snakeCase] || snakeCase;
}

/**
 * Group passes by their effective studio/display category
 */
export function getPassDisplayCategory(passCategory: string): 'pilatesCycling' | 'otherClasses' {
  if (['reformer', 'cycling', 'pilates_cycling'].includes(passCategory)) {
    return 'pilatesCycling';
  }
  return 'otherClasses';
}
