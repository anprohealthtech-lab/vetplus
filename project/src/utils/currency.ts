/**
 * Currency Utility
 * Maps country codes to their respective currencies
 */

import { database } from './supabase';

// Currency mapping based on country code
const CURRENCY_MAP: Record<string, { code: string; symbol: string }> = {
  '+91': { code: 'INR', symbol: '₹' },      // India
  '+92': { code: 'PKR', symbol: '₨' },      // Pakistan
  '+94': { code: 'LKR', symbol: '₨' },      // Sri Lanka
  '+971': { code: 'AED', symbol: 'د.إ' },   // UAE
  '+880': { code: 'BDT', symbol: '৳' },     // Bangladesh
  '+977': { code: 'NPR', symbol: '₨' },     // Nepal
};

// Default currency (India)
const DEFAULT_CURRENCY = { code: 'INR', symbol: '₹' };

/**
 * Get currency info based on lab's country code
 */
export async function getLabCurrency(): Promise<{ code: string; symbol: string }> {
  try {
    const labId = await database.getCurrentUserLabId();
    if (!labId) {
      return DEFAULT_CURRENCY;
    }

    const { data, error } = await database.supabase
      .from('labs')
      .select('country_code')
      .eq('id', labId)
      .single();

    if (error || !data?.country_code) {
      return DEFAULT_CURRENCY;
    }

    return CURRENCY_MAP[data.country_code] || DEFAULT_CURRENCY;
  } catch (error) {
    console.error('Error fetching lab currency:', error);
    return DEFAULT_CURRENCY;
  }
}

/**
 * Get currency symbol based on country code
 */
export function getCurrencySymbol(countryCode: string): string {
  return CURRENCY_MAP[countryCode]?.symbol || DEFAULT_CURRENCY.symbol;
}

/**
 * Get currency code based on country code
 */
export function getCurrencyCode(countryCode: string): string {
  return CURRENCY_MAP[countryCode]?.code || DEFAULT_CURRENCY.code;
}

/**
 * Format amount with currency
 */
export function formatCurrency(amount: number, countryCode?: string): string {
  const currency = countryCode ? CURRENCY_MAP[countryCode] : DEFAULT_CURRENCY;
  return `${currency.symbol}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format amount with currency using Intl.NumberFormat
 */
export function formatCurrencyIntl(amount: number, countryCode?: string): string {
  const currency = countryCode ? CURRENCY_MAP[countryCode] : DEFAULT_CURRENCY;
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
