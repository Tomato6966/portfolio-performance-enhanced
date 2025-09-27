import { Asset } from "../lib/yahooFinanceService";

export interface PortfolioTransaction {
  datum: string // Date in German format
  typ: string // 'Kauf' | 'Verkauf' | 'Auslieferung' | 'Einlieferung' etc.
  wert: string // Value in EUR
  buchungswahrung: string // Booking currency
  bruttobetrag: string // Gross amount
  wahrungBruttobetrag: string // Currency of gross amount
  wechselkurs: string // Exchange rate
  gebuhren: string // Fees
  steuern: string // Taxes
  stuck: string // Number of shares
  isin: string // ISIN code
  wkn: string // WKN code
  tickerSymbol: string // Ticker symbol
  wertpapiername: string // Security name
  notiz?: string // Notes
}

export interface CashTransaction {
  datum: string // Date
  typ: string // 'Einlage' | 'Entnahme' | 'Zinsen' | 'Dividende' etc.
  wert: string // Value
  buchungswahrung: string // Currency
  gebuhren?: string // Fees
  steuern?: string // Taxes
  notiz?: string // Notes
}

export interface ProcessedTransaction {
  id: string
  date: Date
  type: 'buy' | 'sell' | 'dividend' | 'interest' | 'deposit' | 'withdrawal' | 'fee' | 'tax'
  amount: number
  currency: string
  shares?: number
  pricePerShare?: number
  fees: number
  taxes: number
  asset?: {
    isin?: string
    wkn?: string
    symbol?: string
    name: string
  }
  notes?: string
}

export interface PortfolioData {
  transactions: ProcessedTransaction[]
  assets: Map<string, Asset>
  cashTransactions: ProcessedTransaction[]
  startDate: Date
  endDate: Date
  historicalPrices?: Record<string, Record<string, number>> // Store historical prices for cache
}

export interface Portfolio {
  id: string
  name: string
  fileName?: string
  data: PortfolioData
  summary?: PortfolioSummary
}

export interface MultiPortfolioData {
  portfolios: Portfolio[]
  selectedPortfolioIds: string[]
  aggregatedSummary?: PortfolioSummary
}

// Import PortfolioPosition from portfolioCalculations
import type { PortfolioPosition } from '@/lib/portfolioCalculations'

export interface PortfolioSummary {
  totalValue: number
  totalInvested: number
  totalReturn: number
  totalReturnPercentage: number
  totalCash: number
  totalDividends: number
  totalInterest: number
  totalFees: number
  totalTaxes: number
  ttwor: number // Time-Weighted Rate of Return
  assetAllocation: { [symbol: string]: number }
  performance: PerformanceData[]
  positions: PortfolioPosition[]
}

// Re-export PortfolioPosition for convenience
export type { PortfolioPosition }

export interface PerformanceData {
  date: Date
  portfolioValue: number
  invested: number
  cash: number
  return: number
  returnPercentage: number
  taxes: number
  afterTaxReturn: number
  afterTaxReturnPercentage: number
}

export interface DateRangeOption {
  id: string
  label: string
  getValue: (maxDate: Date) => { start: Date; end: Date }
}

export const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  {
    id: 'today',
    label: 'Today',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()),
      end: maxDate
    })
  },
  {
    id: '1d',
    label: '1D',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getTime() - 24 * 60 * 60 * 1000),
      end: maxDate
    })
  },
  {
    id: 'wtd',
    label: 'WTD',
    getValue: (maxDate) => {
      const start = new Date(maxDate)
      start.setDate(maxDate.getDate() - maxDate.getDay())
      return { start, end: maxDate }
    }
  },
  {
    id: 'mtd',
    label: 'MTD',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear(), maxDate.getMonth(), 1),
      end: maxDate
    })
  },
  {
    id: 'ytd',
    label: 'YTD',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear(), 0, 1),
      end: maxDate
    })
  },
  {
    id: '7d',
    label: '7D',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: maxDate
    })
  },
  {
    id: '30d',
    label: '30D',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: maxDate
    })
  },
  {
    id: '3m',
    label: '3M',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear(), maxDate.getMonth() - 3, maxDate.getDate()),
      end: maxDate
    })
  },
  {
    id: '6m',
    label: '6M',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear(), maxDate.getMonth() - 6, maxDate.getDate()),
      end: maxDate
    })
  },
  {
    id: '1y',
    label: '1Y',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear() - 1, maxDate.getMonth(), maxDate.getDate()),
      end: maxDate
    })
  },
  {
    id: '3y',
    label: '3Y',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear() - 3, maxDate.getMonth(), maxDate.getDate()),
      end: maxDate
    })
  },
  {
    id: '5y',
    label: '5Y',
    getValue: (maxDate) => ({
      start: new Date(maxDate.getFullYear() - 5, maxDate.getMonth(), maxDate.getDate()),
      end: maxDate
    })
  }
]
