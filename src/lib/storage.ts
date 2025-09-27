/**
 * LocalStorage utilities for portfolio data persistence
 */

import { Portfolio, ProcessedTransaction } from "@/types/portfolio";

const STORAGE_KEY = 'portfolio-performance-data';
const STORAGE_VERSION = '1.0';

interface StoredPortfolioData {
  version: string;
  timestamp: string;
  portfolios: SerializablePortfolio[];
  selectedPortfolioIds: string[];
}

interface SerializableTransaction {
  id: string;
  date: string; // ISO string instead of Date
  type: 'buy' | 'sell' | 'dividend' | 'interest' | 'deposit' | 'withdrawal' | 'fee' | 'tax';
  amount: number;
  currency: string;
  shares?: number;
  pricePerShare?: number;
  fees: number;
  taxes: number;
  asset?: {
    isin?: string;
    wkn?: string;
    symbol?: string;
    name: string;
  };
  notes?: string;
}

interface SerializablePortfolio {
  id: string;
  name: string;
  fileName?: string;
  transactions: SerializableTransaction[];
  cashTransactions: SerializableTransaction[];
  startDate: string;
  endDate: string;
}

/**
 * Convert Portfolio to serializable format
 */
const serializePortfolio = (portfolio: Portfolio): SerializablePortfolio => {
  return {
    id: portfolio.id,
    name: portfolio.name,
    fileName: portfolio.fileName,
    transactions: portfolio.data.transactions.map(t => ({
      ...t,
      date: t.date.toISOString()
    })) as SerializableTransaction[],
    cashTransactions: portfolio.data.cashTransactions.map(t => ({
      ...t,
      date: t.date.toISOString()
    })) as SerializableTransaction[],
    startDate: portfolio.data.startDate.toISOString(),
    endDate: portfolio.data.endDate.toISOString()
  };
};

/**
 * Convert serialized data back to Portfolio
 */
const deserializePortfolio = (data: SerializablePortfolio): Portfolio => {
  return {
    id: data.id,
    name: data.name,
    fileName: data.fileName,
    data: {
      transactions: data.transactions.map(t => ({
        ...t,
        date: new Date(t.date as unknown as string)
      })),
      cashTransactions: data.cashTransactions.map(t => ({
        ...t,
        date: new Date(t.date as unknown as string)
      })),
      assets: new Map(),
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate)
    }
  };
};

/**
 * Save portfolios to localStorage
 */
export const savePortfoliosToStorage = (
  portfolios: Portfolio[],
  selectedPortfolioIds: string[] = []
): boolean => {
  if (!isBrowser()) {
    console.warn('⚠️ [Storage] Cannot save to localStorage: not in browser environment');
    return false;
  }

  try {
    const data: StoredPortfolioData = {
      version: STORAGE_VERSION,
      timestamp: new Date().toISOString(),
      portfolios: portfolios.map(serializePortfolio),
      selectedPortfolioIds
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log(`💾 [Storage] Saved ${portfolios.length} portfolios to localStorage`);
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to save portfolios to localStorage:', error);
    return false;
  }
};

/**
 * Load portfolios from localStorage
 */
export const loadPortfoliosFromStorage = (): {
  portfolios: Portfolio[];
  selectedPortfolioIds: string[];
} | null => {
  if (!isBrowser()) {
    console.log('📂 [Storage] Cannot load from localStorage: not in browser environment');
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('📂 [Storage] No stored portfolio data found');
      return null;
    }

    const data: StoredPortfolioData = JSON.parse(stored);

    // Check version compatibility
    if (data.version !== STORAGE_VERSION) {
      console.warn(`⚠️ [Storage] Version mismatch. Expected ${STORAGE_VERSION}, found ${data.version}`);
      // Could implement migration logic here in the future
      return null;
    }

    const portfolios = data.portfolios.map(deserializePortfolio);

    console.log(`📂 [Storage] Loaded ${portfolios.length} portfolios from localStorage (saved: ${data.timestamp})`);

    return {
      portfolios,
      selectedPortfolioIds: data.selectedPortfolioIds || []
    };
  } catch (error) {
    console.error('❌ [Storage] Failed to load portfolios from localStorage:', error);
    return null;
  }
};

/**
 * Clear all portfolio data from localStorage
 */
export const clearPortfolioStorage = (): boolean => {
  if (!isBrowser()) {
    console.warn('⚠️ [Storage] Cannot clear localStorage: not in browser environment');
    return false;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ [Storage] Cleared portfolio data from localStorage');
    return true;
  } catch (error) {
    console.error('❌ [Storage] Failed to clear portfolio data from localStorage:', error);
    return false;
  }
};

/**
 * Check if we're running in the browser (not SSR)
 */
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
};

/**
 * Check if portfolio data exists in localStorage
 */
export const hasStoredPortfolioData = (): boolean => {
  if (!isBrowser()) return false;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null;
  } catch (error) {
    console.error('❌ [Storage] Failed to check for stored portfolio data:', error);
    return false;
  }
};

/**
 * Get storage info (size, timestamp, etc.)
 */
export const getStorageInfo = (): {
  hasData: boolean;
  timestamp?: string;
  portfolioCount?: number;
  sizeKB?: number;
} => {
  if (!isBrowser()) {
    return { hasData: false };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { hasData: false };
    }

    const data: StoredPortfolioData = JSON.parse(stored);
    const sizeKB = new Blob([stored]).size / 1024;

    return {
      hasData: true,
      timestamp: data.timestamp,
      portfolioCount: data.portfolios.length,
      sizeKB: Math.round(sizeKB * 100) / 100
    };
  } catch (error) {
    console.error('❌ [Storage] Failed to get storage info:', error);
    return { hasData: false };
  }
};
