/**
 * Phone Number Formatting Utility
 * Handles international phone number formatting with configurable country codes
 */

import { database } from './supabase';

// Supported countries with their codes
export const COUNTRY_CODES = {
  INDIA: '+91',
  PAKISTAN: '+92',
  SRI_LANKA: '+94',
  UAE: '+971',
  BANGLADESH: '+880',
  NEPAL: '+977',
} as const;

export const COUNTRY_CODE_OPTIONS = [
  { value: '+91', label: 'India (+91)', flag: '🇮🇳' },
  { value: '+92', label: 'Pakistan (+92)', flag: '🇵🇰' },
  { value: '+94', label: 'Sri Lanka (+94)', flag: '🇱🇰' },
  { value: '+971', label: 'UAE (+971)', flag: '🇦🇪' },
  { value: '+880', label: 'Bangladesh (+880)', flag: '🇧🇩' },
  { value: '+977', label: 'Nepal (+977)', flag: '🇳🇵' },
];

/**
 * Get the lab's configured country code
 */
export async function getLabCountryCode(): Promise<string> {
  try {
    const labId = await database.getCurrentUserLabId();
    if (!labId) {
      console.warn('No lab ID found, using default country code +91');
      return '+91';
    }

    const { data, error } = await database.supabase
      .from('labs')
      .select('country_code')
      .eq('id', labId)
      .single();

    if (error) {
      console.error('Error fetching lab country code:', error);
      return '+91';
    }

    return data?.country_code || '+91';
  } catch (error) {
    console.error('Error in getLabCountryCode:', error);
    return '+91';
  }
}

/**
 * Format a phone number with the lab's country code if needed
 * @param phone - Phone number (may or may not have country code)
 * @param countryCode - Country code to use (if not provided, fetches from lab settings)
 * @returns Formatted phone number in E.164 format
 */
export function formatPhoneWithCountryCode(phone: string, countryCode: string = '+91'): string {
  if (!phone) return '';

  // Remove all non-digit characters except leading +
  const cleanPhone = phone.replace(/[^\d+]/g, '');

  // If already has a country code (starts with +), return as is
  if (cleanPhone.startsWith('+')) {
    return cleanPhone;
  }

  // If 10 digits (common in most South Asian countries), add country code
  if (cleanPhone.length === 10) {
    return countryCode + cleanPhone;
  }

  // If 11 digits and starts with country code without +, add +
  if (cleanPhone.length === 11 && !cleanPhone.startsWith('+')) {
    return '+' + cleanPhone;
  }

  // If 12 digits (e.g., 9710501234567 for UAE), add +
  if (cleanPhone.length === 12) {
    return '+' + cleanPhone;
  }

  // If 13 digits and country code is +91 or similar (3 digit code + 10 digit number)
  if (cleanPhone.length === 13) {
    return '+' + cleanPhone;
  }

  // Fallback - add country code anyway
  return countryCode + cleanPhone;
}

/**
 * Format phone number asynchronously with lab's country code
 */
export async function formatPhoneWithLabCountryCode(phone: string): Promise<string> {
  const countryCode = await getLabCountryCode();
  return formatPhoneWithCountryCode(phone, countryCode);
}

/**
 * Validate if a phone number is valid for a given country code
 */
export function isValidPhoneForCountryCode(phone: string, countryCode: string): boolean {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  
  switch (countryCode) {
    case '+91': // India - 10 digits
    case '+92': // Pakistan - 10 digits
    case '+94': // Sri Lanka - 9 digits (but we accept 10)
    case '+880': // Bangladesh - 10 digits
    case '+977': // Nepal - 10 digits
      return cleanPhone.length === 10;
    
    case '+971': // UAE - 9 digits typically (but varies)
      return cleanPhone.length >= 9 && cleanPhone.length <= 12;
    
    default:
      return cleanPhone.length >= 8 && cleanPhone.length <= 15;
  }
}
