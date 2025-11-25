/**
 * Currency formatting utilities for the Philippine Peso (₱)
 */

export const PESO_SIGN = '₱';

/**
 * Format a number as Philippine Peso currency
 * @param amount - The amount to format
 * @returns Formatted string with peso sign
 */
export function formatPeso(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return `${PESO_SIGN}0`;
  }
  
  return `${PESO_SIGN}${numAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Format a number as Philippine Peso currency with 2 decimal places
 * @param amount - The amount to format
 * @returns Formatted string with peso sign and 2 decimals
 */
export function formatPesoWithDecimals(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return `${PESO_SIGN}0.00`;
  }
  
  return `${PESO_SIGN}${numAmount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Format a number as Philippine Peso currency with "P" prefix and 2 decimal places
 * Format: P 200.00
 * @param amount - The amount to format
 * @returns Formatted string with "P" prefix and 2 decimals
 */
export function formatMoney(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return 'P 0.00';
  }
  
  return `P ${numAmount.toFixed(2)}`;
}

