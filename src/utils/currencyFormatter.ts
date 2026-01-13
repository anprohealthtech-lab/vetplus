/**
 * Currency Formatting Utility
 * Handles multi-currency formatting based on lab settings
 */

import { database } from './supabase';

// Supported currencies with their symbols and formatting
export const CURRENCY_CONFIG = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  PKR: { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee', locale: 'en-PK' },
  LKR: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', locale: 'en-LK' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  BDT: { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', locale: 'bn-BD' },
  NPR: { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee', locale: 'en-NP' },
} as const;

export type CurrencyCode = keyof typeof CURRENCY_CONFIG;

export const CURRENCY_OPTIONS = [
  { value: 'INR', label: '🇮🇳 Indian Rupee (₹)', flag: '🇮🇳' },
  { value: 'PKR', label: '🇵🇰 Pakistani Rupee (Rs)', flag: '🇵🇰' },
  { value: 'LKR', label: '🇱🇰 Sri Lankan Rupee (Rs)', flag: '🇱🇰' },
  { value: 'AED', label: '🇦🇪 UAE Dirham (د.إ)', flag: '🇦🇪' },
  { value: 'BDT', label: '🇧🇩 Bangladeshi Taka (৳)', flag: '🇧🇩' },
  { value: 'NPR', label: '🇳🇵 Nepalese Rupee (Rs)', flag: '🇳🇵' },
];

// Map country codes to currency codes
export const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  '+91': 'INR',   // India
  '+92': 'PKR',   // Pakistan
  '+94': 'LKR',   // Sri Lanka
  '+971': 'AED',  // UAE
  '+880': 'BDT',  // Bangladesh
  '+977': 'NPR',  // Nepal
};

/**
 * Get the lab's configured currency code
 */
export async function getLabCurrency(): Promise<CurrencyCode> {
  try {
    const labId = await database.getCurrentUserLabId();
    if (!labId) {
      console.warn('No lab ID found, using default currency INR');
      return 'INR';
    }

    const { data, error } = await database.supabase
      .from('labs')
      .select('currency_code')
      .eq('id', labId)
      .single();

    if (error) {
      console.error('Error fetching lab currency:', error);
      return 'INR';
    }

    const currencyCode = data?.currency_code as CurrencyCode;
    return currencyCode && currencyCode in CURRENCY_CONFIG ? currencyCode : 'INR';
  } catch (error) {
    console.error('Error in getLabCurrency:', error);
    return 'INR';
  }
}

/**
 * Get currency configuration for a given currency code
 */
export function getCurrencyConfig(currencyCode: CurrencyCode = 'INR') {
  return CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.INR;
}

/**
 * Format amount with currency symbol
 * @param amount - Amount to format
 * @param currencyCode - Currency code (if not provided, uses INR)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currencyCode: CurrencyCode = 'INR'): string {
  const config = getCurrencyConfig(currencyCode);
  
  try {
    // Use Intl.NumberFormat for proper locale formatting
    const formatted = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
    
    return formatted;
  } catch (error) {
    // Fallback to simple formatting if Intl fails
    return `${config.symbol}${(amount || 0).toFixed(2)}`;
  }
}

/**
 * Format amount with lab's currency (async version)
 */
export async function formatCurrencyWithLabSettings(amount: number): Promise<string> {
  const currencyCode = await getLabCurrency();
  return formatCurrency(amount, currencyCode);
}

/**
 * Get currency symbol only
 */
export function getCurrencySymbol(currencyCode: CurrencyCode = 'INR'): string {
  return getCurrencyConfig(currencyCode).symbol;
}

/**
 * Get currency symbol for lab (async)
 */
export async function getLabCurrencySymbol(): Promise<string> {
  const currencyCode = await getLabCurrency();
  return getCurrencySymbol(currencyCode);
}

/**
 * Parse currency string to number
 */
export function parseCurrency(currencyString: string): number {
  // Remove all non-digit characters except decimal point and minus
  const cleaned = currencyString.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Get suggested currency for a country code
 */
export function getCurrencyForCountryCode(countryCode: string): CurrencyCode {
  return COUNTRY_TO_CURRENCY[countryCode] || 'INR';
}
