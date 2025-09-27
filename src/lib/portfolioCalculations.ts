import { eachDayOfInterval, format } from "date-fns";

import { AssetFetchingStatus, PortfolioFetchingProgress } from "@/components/AssetFetchingProgress";
import { PerformanceData, PortfolioSummary, ProcessedTransaction } from "@/types/portfolio";

import { delay } from "./utils";
import { Asset, EQUITY_TYPES, getHistoricalData, searchAssets } from "./yahooFinanceService";

export interface PortfolioPosition {
  symbol: string
  isin?: string
  name: string
  shares: number
  averagePrice: number
  totalCost: number
  currentPrice: number
  currentValue: number
  unrealizedGain: number
  unrealizedGainPercent: number
  weight: number
}

export interface PortfolioSnapshot {
  date: Date
  totalValue: number
  totalInvested: number
  totalCash: number
  positions: PortfolioPosition[]
  performance: number
  performancePercent: number
}

export class PortfolioManager {


  yahooFinanceDelay: number = 50
  private transactions: ProcessedTransaction[] = []
  private cashTransactions: ProcessedTransaction[] = []
  private assets: Map<string, Asset> = new Map()
  private historicalPrices: Map<string, Map<string, number>> = new Map()

  constructor() {}

  // Export historical prices for storage
  exportHistoricalPrices(): Record<string, Record<string, number>> {
    const exported: Record<string, Record<string, number>> = {}
    this.historicalPrices.forEach((priceMap, symbol) => {
      exported[symbol] = Object.fromEntries(priceMap.entries())
    })
    return exported
  }

  // Import historical prices from storage
  importHistoricalPrices(historicalPrices: Record<string, Record<string, number>>): void {
    this.historicalPrices.clear()
    Object.entries(historicalPrices).forEach(([symbol, priceData]) => {
      this.historicalPrices.set(symbol, new Map(Object.entries(priceData)))
    })
  }

  async loadTransactions(
    portfolioTransactions: ProcessedTransaction[],
    cashTransactions: ProcessedTransaction[],
    progressCallback?: (progress: PortfolioFetchingProgress) => void,
    portfolioName?: string
  ): Promise<void> {
    console.log(`🔍 [Portfolio Manager] Loading ${portfolioTransactions.length} portfolio transactions and ${cashTransactions.length} cash transactions`)

    this.transactions = portfolioTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())
    this.cashTransactions = cashTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())

    // Extract unique assets with proper prioritization and validation
    const assetMap = new Map<string, { identifier: string; asset: any; keyType: string; csvSymbol?: string }>()

    this.transactions.forEach((transaction, index) => {
      if (transaction.asset) {
        // Prioritize identifiers: ISIN > WKN > Symbol > Name (same as before)
        let identifier = ''
        let keyType = ''

        if (transaction.asset.isin && transaction.asset.isin.trim().length >= 12) {
          identifier = transaction.asset.isin.trim()
          keyType = 'ISIN'
        } else if (transaction.asset.wkn && transaction.asset.wkn.trim().length >= 6) {
          identifier = transaction.asset.wkn.trim()
          keyType = 'WKN'
        } else if (transaction.asset.symbol && transaction.asset.symbol.trim().length >= 1) {
          identifier = transaction.asset.symbol.trim()
          keyType = 'Symbol'
        } else if (transaction.asset.name && transaction.asset.name.trim().length >= 3) {
          identifier = transaction.asset.name.trim()
          keyType = 'Name'
        }

        if (identifier) {
          // Only add if we don't already have this identifier or if this is a higher priority
          const existing = assetMap.get(identifier)
          if (!existing || (keyType === 'ISIN' && existing.keyType !== 'ISIN') ||
              (keyType === 'WKN' && !['ISIN'].includes(existing.keyType))) {
            const csvSymbol = transaction.asset?.symbol?.trim()
            console.log(`🏢 [Portfolio Manager] Found asset in transaction ${index + 1}: ${keyType} = ${identifier}${csvSymbol ? ` (CSV Symbol: ${csvSymbol})` : ''}`)
            assetMap.set(identifier, {
              identifier,
              asset: transaction.asset,
              keyType,
              csvSymbol // Store CSV symbol for fetching priority
            })
          }
        } else {
          console.warn(`⚠️ [Portfolio Manager] Transaction ${index + 1} has asset but no valid identifier:`, transaction.asset)
        }
      } else {
        console.log(`💰 [Portfolio Manager] Transaction ${index + 1} is cash-only (${transaction.type})`)
      }
    })

    console.log(`📊 [Portfolio Manager] Found ${assetMap.size} unique assets:`)
    Array.from(assetMap.entries()).forEach(([id, data]) => {
      console.log(`  - ${id}: ${data.asset.name || 'Unknown name'}`)
    })

    // Load asset information and historical data only if progressCallback provided
    // (Skip when loading from localStorage cache)
    if (progressCallback) {
      await this.loadAssetData(Array.from(assetMap.keys()), assetMap, progressCallback, portfolioName || 'Portfolio')
    } else {
      console.log(`⚡ [Portfolio Manager] Skipping asset data fetching (loading from cache)`)
    }
  }

  private async loadAssetData(
    identifiers: string[],
    assetMap: Map<string, { identifier: string; asset: any; keyType: string; csvSymbol?: string }>,
    progressCallback?: (progress: PortfolioFetchingProgress) => void,
    portfolioName: string = 'Portfolio'
  ): Promise<void> {
    console.log(`🌐 Loading ${identifiers.length} assets (parallel processing with retries)`)

    // Filter out invalid identifiers
    const validIdentifiers = identifiers.filter(id => id && id.trim().length >= 2)

    console.log(`📋 Processing ${validIdentifiers.length} valid identifiers`)

    // Initialize progress tracking
    const assetStatuses: AssetFetchingStatus[] = validIdentifiers.map(id => ({
      identifier: id,
      status: 'pending'
    }))

    const updateProgress = () => {
      if (progressCallback) {
        const completedCount = assetStatuses.filter(s => s.status === 'completed').length
        const processingAssets = assetStatuses.filter(s =>
          s.status === 'searching' || s.status === 'loading_prices'
        )

        progressCallback({
          portfolioName,
          totalAssets: validIdentifiers.length,
          completedAssets: completedCount,
          currentAsset: processingAssets.length > 0 ?
            `${processingAssets.length} assets in progress` : undefined,
          assetStatuses: [...assetStatuses],
          overallStatus: completedCount === validIdentifiers.length ? 'completed' : 'processing'
        })
      }
    }

    // Initial progress update
    updateProgress()

    // Configuration for parallel processing
    const BATCH_SIZE = 3 // Process 3 assets at a time (reduced for proxy stability)
    const MAX_RETRIES = 2
    const RETRY_DELAY = 2000 // 2 seconds between retries

    // Helper function to process a single asset
    const processAsset = async (identifier: string, index: number, retryCount = 0): Promise<void> => {
      const originalId = validIdentifiers[index]
      const lowerIdentifier = identifier.toLowerCase()
      const assetData = assetMap.get(identifier)

      try {
        console.log(`[${index + 1}/${validIdentifiers.length}] ${identifier} (attempt ${retryCount + 1})`)

        // Update status to searching
        assetStatuses[index].status = 'searching'
        updateProgress()

        // PRIORITY 1: Try CSV symbol directly if available
        let searchResults: Asset[] = []
        let usedDirectLookup = false

        if (assetData?.csvSymbol && assetData.csvSymbol.trim().length > 0) {
          const csvSymbol = assetData.csvSymbol.trim()
          console.log(`🎯 [CSV Symbol] Trying direct lookup with CSV symbol: ${csvSymbol} for asset: ${identifier}`)

          try {
            const testStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            const testEndDate = new Date()
            const directResult = await getHistoricalData(csvSymbol.toUpperCase(), testStartDate, testEndDate)

            if (directResult.historicalData.size > 0) {
              // CSV symbol lookup successful!
              console.log(`✅ [CSV Symbol] Success for CSV symbol: ${csvSymbol} → ${identifier}`)
              const asset: Asset = {
                id: csvSymbol.toUpperCase(),
                isin: assetData.asset.isin || '',
                wkn: assetData.asset.wkn || '',
                name: directResult.longName || assetData.asset.name || csvSymbol.toUpperCase(),
                rank: '1',
                symbol: csvSymbol.toUpperCase(),
                quoteType: 'ETF', // Default type
                price: '0',
                priceChange: '0',
                priceChangePercent: '0',
                historicalData: new Map(),
                investments: [],
              }

              assetStatuses[index].status = 'found'
              assetStatuses[index].assetName = asset.name
              assetStatuses[index].symbol = asset.symbol
              updateProgress()

              // Store the asset
              this.assets.set(originalId, asset)

              // Load full historical data
              assetStatuses[index].status = 'loading_prices'
              updateProgress()

              const fullHistoricalData = await getHistoricalData(asset.symbol, this.getStartDate(), new Date())
              this.historicalPrices.set(asset.symbol, fullHistoricalData.historicalData)

              assetStatuses[index].status = 'completed'
              assetStatuses[index].priceCount = fullHistoricalData.historicalData.size
              updateProgress()

              console.log(`🎯 [CSV Symbol] Complete: ${csvSymbol} → ${fullHistoricalData.historicalData.size} prices`)
              usedDirectLookup = true
              return // Success, skip search
            }
          } catch (directError) {
            console.log(`🎯 [CSV Symbol] Failed for ${csvSymbol}, falling back to regular logic`)
            // Fall through to other methods
          }
        }

        // PRIORITY 2: Try direct ticker lookup for short identifiers that look like symbols
        if (!usedDirectLookup && lowerIdentifier.length <= 5 && /^[A-Z]+$/i.test(lowerIdentifier) && !lowerIdentifier.includes('.')) {
          // Looks like a ticker symbol, try direct historical data fetch first
          console.log(`🎯 [Direct Lookup] Trying direct ticker lookup for: ${identifier}`)
          try {
            const testStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            const testEndDate = new Date()
            const directResult = await getHistoricalData(identifier.toUpperCase(), testStartDate, testEndDate)

            if (directResult.historicalData.size > 0) {
              // Direct lookup successful - create asset from ticker
              console.log(`✅ [Direct Lookup] Success for ticker: ${identifier}`)
              const asset: Asset = {
                id: identifier.toUpperCase(),
                isin: '',
                wkn: '',
                name: directResult.longName || identifier.toUpperCase(),
                rank: '1',
                symbol: identifier.toUpperCase(),
                quoteType: 'ETF', // Default type
                price: '0',
                priceChange: '0',
                priceChangePercent: '0',
                historicalData: new Map(),
                investments: [],
              }

              assetStatuses[index].status = 'found'
              assetStatuses[index].assetName = asset.name
              assetStatuses[index].symbol = asset.symbol
              updateProgress()

              // Store the asset
              this.assets.set(originalId, asset)

              // Load full historical data
              assetStatuses[index].status = 'loading_prices'
              updateProgress()

              const fullHistoricalData = await getHistoricalData(asset.symbol, this.getStartDate(), new Date())
              this.historicalPrices.set(asset.symbol, fullHistoricalData.historicalData)

              assetStatuses[index].status = 'completed'
              assetStatuses[index].priceCount = fullHistoricalData.historicalData.size
              updateProgress()

              console.log(`🎯 [Direct Lookup] Complete: ${identifier} → ${fullHistoricalData.historicalData.size} prices`)
              usedDirectLookup = true
              return // Success, skip search
            }
          } catch (directError) {
            console.log(`🎯 [Direct Lookup] Failed for ${identifier}, falling back to search`)
            // Fall through to search
          }
        }

        // Search for the asset (only if direct lookup wasn't used)
        if (!usedDirectLookup) {
          try {
            searchResults = await searchAssets(identifier, EQUITY_TYPES.all)
          } catch (searchError) {
            const errorMsg = searchError instanceof Error ? searchError.message : 'Search failed'

            // Check if this is a rate limit or timeout error that should be retried
            if (retryCount < MAX_RETRIES && this.shouldRetry(errorMsg)) {
              console.warn(`⚠️ Retryable error for ${identifier}: ${errorMsg}, retrying...`)
              await delay(RETRY_DELAY + (retryCount * 1000)) // Exponential backoff
              return processAsset(identifier, index, retryCount + 1)
            }

            console.warn(`❌ Search failed: ${identifier} - ${errorMsg}`)
            assetStatuses[index].status = 'failed'
            assetStatuses[index].error = `Search failed: ${errorMsg}`
            updateProgress()
            return
          }

          if (searchResults.length === 0) {
            console.warn(`❌ No results: ${identifier}`)
            assetStatuses[index].status = 'failed'
            assetStatuses[index].error = 'No results found'
            updateProgress()
            return
          }

          // Find best match based on identifier type
          let asset: Asset | null = searchResults[0]

          // ISIN format
          if (lowerIdentifier.length === 12 && /^[A-Z]{2}[A-Z0-9]{10}$/i.test(lowerIdentifier)) {
            asset = searchResults.find(a => a.isin?.toLowerCase() === lowerIdentifier) || asset
          }
          // WKN or Symbol format
          else if (lowerIdentifier.length >= 6 && lowerIdentifier.length <= 10 && /^[A-Z0-9]+$/i.test(lowerIdentifier)) {
            asset = searchResults.find(a =>
              a.wkn?.toLowerCase() === lowerIdentifier ||
              a.symbol?.toLowerCase() === lowerIdentifier
            ) || asset
          }
          // Ticker symbol
          else if (lowerIdentifier.length <= 5 && /^[A-Z]+$/i.test(lowerIdentifier)) {
            asset = searchResults.find(a => a.symbol?.toLowerCase() === lowerIdentifier) || asset
          }

          if (!asset) {
            console.warn(`❌ No match: ${identifier}`)
            assetStatuses[index].status = 'failed'
            assetStatuses[index].error = 'No match found'
            updateProgress()
            return
          }

          console.log(`✅ Found: ${identifier} → ${asset.symbol} (${asset.name})`)

          // Update status to found
          assetStatuses[index].status = 'found'
          assetStatuses[index].assetName = asset.name
          assetStatuses[index].symbol = asset.symbol
          updateProgress()

          // Store the asset using original identifier
          this.assets.set(originalId, asset)

          // Load historical data
          assetStatuses[index].status = 'loading_prices'
          updateProgress()

          try {
            const startDate = this.getStartDate()
            const endDate = new Date()
            const historicalData = await getHistoricalData(asset.symbol, startDate, endDate)
            this.historicalPrices.set(asset.symbol, historicalData.historicalData)
            console.log(`📊 Loaded ${historicalData.historicalData.size} prices for ${asset.symbol}`)

            // Update status to completed
            assetStatuses[index].status = 'completed'
            assetStatuses[index].priceCount = historicalData.historicalData.size
            updateProgress()
          } catch (histError) {
            const errorMsg = histError instanceof Error ? histError.message : 'Historical data failed'

            // Check if this is a rate limit or timeout error that should be retried
            if (retryCount < MAX_RETRIES && this.shouldRetry(errorMsg)) {
              console.warn(`⚠️ Retrying historical data for ${asset.symbol}: ${errorMsg}`)
              await delay(RETRY_DELAY + (retryCount * 1000))
              return processAsset(identifier, index, retryCount + 1)
            }

            console.warn(`⚠️ No historical data for ${asset.symbol}: ${errorMsg}`)
            assetStatuses[index].status = 'completed'
            assetStatuses[index].priceCount = 0
            updateProgress()
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'

        // Check if this is a rate limit or timeout error that should be retried
        if (retryCount < MAX_RETRIES && this.shouldRetry(errorMsg)) {
          console.warn(`⚠️ Retrying ${identifier}: ${errorMsg}`)
          await delay(RETRY_DELAY + (retryCount * 1000))
          return processAsset(identifier, index, retryCount + 1)
        }

        console.error(`❌ Error: ${identifier} - ${errorMsg}`)
        assetStatuses[index].status = 'failed'
        assetStatuses[index].error = errorMsg
        updateProgress()
      }
    }

    // Process assets in parallel batches
    for (let i = 0; i < validIdentifiers.length; i += BATCH_SIZE) {
      const batch = validIdentifiers.slice(i, i + BATCH_SIZE)
      const batchPromises = batch.map((identifier, batchIndex) => {
        const globalIndex = i + batchIndex
        return processAsset(identifier, globalIndex)
      })

      // Wait for current batch to complete before starting next batch
      await Promise.all(batchPromises)

      // Longer delay between batches to be respectful to the proxies
      if (i + BATCH_SIZE < validIdentifiers.length) {
        await delay(2000) // 2 second delay between batches
      }
    }

    // Final progress update
    updateProgress()
    console.log(`✅ Asset loading complete: ${this.assets.size}/${identifiers.length} loaded`)
  }

  private shouldRetry(errorMessage: string): boolean {
    const retryableErrors = [
      'rate limit',
      'too many requests',
      'timeout',
      'network',
      'fetch failed',
      'proxy error',
      'cors',
      'mixed content',
      '429',
      '503',
      '502',
      '504',
      '0', // Network error code 0 often indicates CORS issues
      'ECONNRESET',
      'ETIMEDOUT'
    ]

    const lowerError = errorMessage.toLowerCase()
    return retryableErrors.some(retryable => lowerError.includes(retryable))
  }

  private getStartDate(): Date {
    const allDates = [
      ...this.transactions.map(t => t.date),
      ...this.cashTransactions.map(t => t.date)
    ]

    return allDates.length > 0
      ? new Date(Math.min(...allDates.map(d => d.getTime())))
      : new Date()
  }

  private getEndDate(): Date {
    const allDates = [
      ...this.transactions.map(t => t.date),
      ...this.cashTransactions.map(t => t.date)
    ]

    return allDates.length > 0
      ? new Date(Math.max(...allDates.map(d => d.getTime())))
      : new Date()
  }

  getDateRange(): { start: Date; end: Date } {
    return {
      start: this.getStartDate(),
      end: this.getEndDate()
    }
  }

  private getAssetPrice(symbol: string, date: Date): number {
    const prices = this.historicalPrices.get(symbol)
    if (!prices) {
      console.warn(`📈 [Price Lookup] No historical prices found for ticker: ${symbol}`)
      return 0
    }

    const dateKey = format(date, 'yyyy-MM-dd')
    console.log(`📅 [Price Lookup] Looking for price of ${symbol} on ${dateKey}`)

    // Try exact date first
    if (prices.has(dateKey)) {
      const price = prices.get(dateKey) || 0
      console.log(`✅ [Price Lookup] Found exact price for ${symbol} on ${dateKey}: $${price}`)
      return price
    }

    // Find closest date
    const availableDates = Array.from(prices.keys()).sort()
    console.log(`🔍 [Price Lookup] No exact date, searching ${availableDates.length} available dates for closest to ${dateKey}`)

    if (availableDates.length === 0) {
      console.warn(`📈 [Price Lookup] No price dates available for ${symbol}`)
      return 0
    }

    const targetTime = date.getTime()

    let closestDate = availableDates[0]
    let closestDiff = Math.abs(new Date(closestDate).getTime() - targetTime)

    for (const availableDate of availableDates) {
      const diff = Math.abs(new Date(availableDate).getTime() - targetTime)
      if (diff < closestDiff) {
        closestDiff = diff
        closestDate = availableDate
      }
    }

    const closestPrice = prices.get(closestDate) || 0
    console.log(`📊 [Price Lookup] Closest date for ${symbol}: ${closestDate} (${Math.round(closestDiff / (1000 * 60 * 60 * 24))} days away) = $${closestPrice}`)

    return closestPrice
  }

  private calculatePositions(asOfDate: Date): Map<string, PortfolioPosition> {
    const positions = new Map<string, PortfolioPosition>()

    // Process transactions up to the given date
    const relevantTransactions = this.transactions.filter(t => t.date <= asOfDate)
    console.log(`📊 [Position Calculator] Processing ${relevantTransactions.length} transactions as of ${asOfDate.toISOString().split('T')[0]}`)

    relevantTransactions.forEach((transaction, index) => {
      if (!transaction.asset) {
        console.log(`💰 [Position Calculator] Transaction ${index + 1} is cash-only: ${transaction.type}`)
        return
      }

      // Find asset using priority: ISIN > WKN > Symbol > Name
      let assetKey = ''
      let asset: Asset | null = null

      if (transaction.asset.isin) {
        assetKey = transaction.asset.isin
        asset = this.assets.get(assetKey) || null
      } else if (transaction.asset.wkn) {
        assetKey = transaction.asset.wkn
        asset = this.assets.get(assetKey) || null
      } else if (transaction.asset.symbol) {
        assetKey = transaction.asset.symbol
        asset = this.assets.get(assetKey) || null
      } else if (transaction.asset.name) {
        assetKey = transaction.asset.name
        asset = this.assets.get(assetKey) || null
      }

      if (!asset) {
        console.warn(`⚠️ [Position Calculator] No asset data found for transaction ${index + 1} with key: ${assetKey}`)
        return
      }

      console.log(`🏢 [Position Calculator] Processing ${transaction.type} for ${assetKey} → ticker: ${asset.symbol}`)

      let position = positions.get(assetKey)

      if (!position) {
        const currentPrice = this.getAssetPrice(asset.symbol, asOfDate)
        console.log(`💰 [Position Calculator] Current price for ${asset.symbol}: $${currentPrice}`)

        position = {
          symbol: asset.symbol,
          isin: transaction.asset.isin,
          name: transaction.asset.name || asset.name,
          shares: 0,
          averagePrice: 0,
          totalCost: 0,
          currentPrice: currentPrice,
          currentValue: 0,
          unrealizedGain: 0,
          unrealizedGainPercent: 0,
          weight: 0
        }
        positions.set(assetKey, position)
        console.log(`📝 [Position Calculator] Created new position for ${assetKey} with current price $${currentPrice}`)
      }

      const transactionShares = transaction.shares || 0
      const transactionPrice = transaction.pricePerShare || 0

      if (transaction.type === 'buy') {
        // Update average price using weighted average
        if (position.shares + transactionShares > 0) {
          position.averagePrice =
            (position.totalCost + Math.abs(transaction.amount)) /
            (position.shares + transactionShares)
        }

        position.shares += transactionShares
        position.totalCost += Math.abs(transaction.amount)
      } else if (transaction.type === 'sell') {
        const soldShares = Math.min(transactionShares, position.shares)
        const soldCost = soldShares * position.averagePrice

        position.shares -= soldShares
        position.totalCost -= soldCost

        // If all shares sold, reset average price
        if (position.shares <= 0) {
          position.averagePrice = 0
          position.totalCost = 0
        }
      }
    })

    // Calculate current values and gains
    positions.forEach(position => {
      position.currentValue = position.shares * position.currentPrice
      position.unrealizedGain = position.currentValue - position.totalCost
      position.unrealizedGainPercent = position.totalCost > 0
        ? (position.unrealizedGain / position.totalCost) * 100
        : 0
    })

    return positions
  }

  private calculateCashBalance(asOfDate: Date): number {
    let cashBalance = 0

    // Portfolio transactions affect cash
    this.transactions
      .filter(t => t.date <= asOfDate)
      .forEach(transaction => {
        if (transaction.type === 'buy') {
          cashBalance -= Math.abs(transaction.amount) + transaction.fees + transaction.taxes
        } else if (transaction.type === 'sell') {
          cashBalance += Math.abs(transaction.amount) - transaction.fees - transaction.taxes
        } else if (transaction.type === 'dividend') {
          cashBalance += Math.abs(transaction.amount) - transaction.taxes
        } else if (transaction.type === 'interest') {
          cashBalance += Math.abs(transaction.amount) - transaction.taxes
        }
      })

    // Cash transactions
    this.cashTransactions
      .filter(t => t.date <= asOfDate)
      .forEach(transaction => {
        if (transaction.type === 'deposit') {
          cashBalance += Math.abs(transaction.amount)
        } else if (transaction.type === 'withdrawal') {
          cashBalance -= Math.abs(transaction.amount)
        } else if (transaction.type === 'fee') {
          cashBalance -= Math.abs(transaction.amount)
        } else if (transaction.type === 'tax') {
          cashBalance -= Math.abs(transaction.amount)
        } else if (transaction.type === 'interest') {
          cashBalance += Math.abs(transaction.amount) - transaction.taxes
        }
      })

    return cashBalance
  }

  private calculateTotalInvested(asOfDate: Date): number {
    let totalInvested = 0

    console.log(`💰 [Invested Calculator] Calculating total invested as of ${asOfDate.toISOString().split('T')[0]}`)

    // Cash deposits count as invested
    this.cashTransactions
      .filter(t => t.date <= asOfDate)
      .forEach(transaction => {
        if (transaction.type === 'deposit') {
          totalInvested += Math.abs(transaction.amount)
          console.log(`📈 [Invested Calculator] Deposit: +${Math.abs(transaction.amount)} (Total: ${totalInvested})`)
        } else if (transaction.type === 'withdrawal') {
          totalInvested -= Math.abs(transaction.amount)
          console.log(`📉 [Invested Calculator] Withdrawal: -${Math.abs(transaction.amount)} (Total: ${totalInvested})`)
        }
      })

    console.log(`✅ [Invested Calculator] Total invested: ${totalInvested}`)
    return totalInvested
  }

  calculatePortfolioSnapshot(asOfDate: Date): PortfolioSnapshot {
    const positions = this.calculatePositions(asOfDate)
    const positionsArray = Array.from(positions.values()).filter(p => p.shares > 0)
    const cashBalance = this.calculateCashBalance(asOfDate)

    // Use the new invested calculation method
    const totalInvested = this.calculateTotalInvested(asOfDate)
    const totalPositionValue = positionsArray.reduce((sum, p) => sum + p.currentValue, 0)
    const totalValue = totalPositionValue + cashBalance

    // Calculate interest and dividends earned up to this date
    const portfolioInterest = this.transactions
      .filter(t => t.type === 'interest' && t.date <= asOfDate)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const cashInterest = this.cashTransactions
      .filter(t => t.type === 'interest' && t.date <= asOfDate)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const totalDividends = this.transactions
      .filter(t => t.type === 'dividend' && t.date <= asOfDate)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const totalInterestEarned = portfolioInterest + cashInterest

    // Calculate weights
    positionsArray.forEach(position => {
      position.weight = totalValue > 0 ? (position.currentValue / totalValue) * 100 : 0
    })

    // Performance = Current Value - Total Invested
    // Interest and dividends are already included in the cash balance (totalValue)
    const performance = totalValue - totalInvested
    const performancePercent = totalInvested > 0 ? (performance / totalInvested) * 100 : 0

    console.log(`📊 [Portfolio Snapshot] ${asOfDate.toISOString().split('T')[0]}:`, {
      totalValue,
      totalInvested,
      totalInterestEarned,
      totalDividends,
      performance,
      performancePercent: `${performancePercent.toFixed(2)}%`
    })

    return {
      date: asOfDate,
      totalValue,
      totalInvested,
      totalCash: cashBalance,
      positions: positionsArray.sort((a, b) => b.currentValue - a.currentValue),
      performance,
      performancePercent
    }
  }

  calculatePerformanceHistory(startDate: Date, endDate: Date): PerformanceData[] {
    const dates = eachDayOfInterval({ start: startDate, end: endDate })

    return dates.map(date => {
      const snapshot = this.calculatePortfolioSnapshot(date)

      // Calculate cumulative taxes up to this date
      const cumulativeTaxes = this.transactions
        .filter(t => t.date <= date)
        .reduce((sum, t) => sum + t.taxes, 0) +
        this.cashTransactions
        .filter(t => t.date <= date)
        .reduce((sum, t) => sum + t.taxes, 0)

      // After-tax return = return - taxes
      const afterTaxReturn = snapshot.performance - cumulativeTaxes
      const afterTaxReturnPercentage = snapshot.totalInvested > 0
        ? (afterTaxReturn / snapshot.totalInvested) * 100
        : 0

      if (date.toISOString().split('T')[0] === endDate.toISOString().split('T')[0]) {
        console.log(`📊 [Performance History] Final day calculation:`, {
          date: date.toISOString().split('T')[0],
          'snapshot.performance (gross return)': snapshot.performance,
          'cumulativeTaxes': cumulativeTaxes,
          'afterTaxReturn (net return)': afterTaxReturn,
          'calculation': `${snapshot.performance} - ${cumulativeTaxes} = ${afterTaxReturn}`
        })
      }

      return {
        date,
        portfolioValue: snapshot.totalValue,
        invested: snapshot.totalInvested,
        cash: snapshot.totalCash,
        return: snapshot.performance,
        returnPercentage: snapshot.performancePercent,
        taxes: cumulativeTaxes,
        afterTaxReturn,
        afterTaxReturnPercentage
      }
    })
  }

  calculateSummary(startDate: Date, endDate: Date): PortfolioSummary {
    const currentSnapshot = this.calculatePortfolioSnapshot(endDate)
    const performanceHistory = this.calculatePerformanceHistory(startDate, endDate)

    const totalDividends = this.transactions
      .filter(t => t.type === 'dividend' && t.date >= startDate && t.date <= endDate)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    // Calculate interest from both portfolio transactions and cash transactions
    const portfolioInterest = this.transactions
      .filter(t => t.type === 'interest' && t.date >= startDate && t.date <= endDate)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const cashInterest = this.cashTransactions
      .filter(t => t.type === 'interest' && t.date >= startDate && t.date <= endDate)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const totalInterest = portfolioInterest + cashInterest

    console.log(`📊 [Portfolio Summary] Interest calculation:`, {
      portfolioInterest,
      cashInterest,
      totalInterest,
      dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
    })

    const totalFees = [
      ...this.transactions.filter(t => t.date >= startDate && t.date <= endDate),
      ...this.cashTransactions.filter(t => t.date >= startDate && t.date <= endDate)
    ].reduce((sum, t) => sum + t.fees, 0)

    const totalTaxes = [
      ...this.transactions.filter(t => t.date >= startDate && t.date <= endDate),
      ...this.cashTransactions.filter(t => t.date >= startDate && t.date <= endDate)
    ].reduce((sum, t) => sum + t.taxes, 0)

    const assetAllocation: { [symbol: string]: number } = {}
    currentSnapshot.positions.forEach(position => {
      assetAllocation[position.symbol] = position.weight
    })

    // Calculate TTWOR for the specified date range
    const ttwor = this.calculateTTWOR(startDate, endDate)

    return {
      totalValue: currentSnapshot.totalValue,
      totalInvested: currentSnapshot.totalInvested,
      totalReturn: currentSnapshot.performance,
      totalReturnPercentage: currentSnapshot.performancePercent,
      totalCash: currentSnapshot.totalCash,
      totalDividends,
      totalInterest,
      totalFees,
      totalTaxes,
      ttwor,
      assetAllocation,
      performance: performanceHistory,
      positions: currentSnapshot.positions
    }
  }

  getAssets(): Asset[] {
    return Array.from(this.assets.values())
  }

  getCurrentPositions(): PortfolioPosition[] {
    return this.calculatePortfolioSnapshot(new Date()).positions
  }

  // Public methods to access internal data for aggregation
  getTransactions(): ProcessedTransaction[] {
    return [...this.transactions]
  }

  getCashTransactions(): ProcessedTransaction[] {
    return [...this.cashTransactions]
  }

  getAssetsMap(): Map<string, Asset> {
    return new Map(this.assets)
  }

  getHistoricalPricesMap(): Map<string, Map<string, number>> {
    return new Map(this.historicalPrices)
  }

  // Method to create a combined manager from multiple managers
  static createCombinedManager(managers: PortfolioManager[]): PortfolioManager {
    const combinedManager = new PortfolioManager()

    // Combine all transactions
    const allTransactions: ProcessedTransaction[] = []
    const allCashTransactions: ProcessedTransaction[] = []
    const combinedAssets = new Map<string, Asset>()
    const combinedHistoricalPrices = new Map<string, Map<string, number>>()

    managers.forEach(manager => {
      allTransactions.push(...manager.getTransactions())
      allCashTransactions.push(...manager.getCashTransactions())

      manager.getAssetsMap().forEach((value, key) => {
        combinedAssets.set(key, value)
      })

      manager.getHistoricalPricesMap().forEach((value, key) => {
        combinedHistoricalPrices.set(key, value)
      })
    })

    // Set combined data
    combinedManager.transactions = allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())
    combinedManager.cashTransactions = allCashTransactions.sort((a, b) => a.date.getTime() - b.date.getTime())
    combinedManager.assets = combinedAssets
    combinedManager.historicalPrices = combinedHistoricalPrices

    return combinedManager
  }

  /**
   * Calculate Time-Weighted Rate of Return (TTWOR)
   * TTWOR berechnet die Performance, als ob das gesamte Investment von Anfang an investiert gewesen wäre
   * Beispiel: 100€ im Januar, 100€ im Februar usw. = insgesamt 1200€
   * TTWOR zeigt, wie sich 1200€ entwickelt hätten, wenn sie alle im Januar investiert worden wären
   */
  calculateTTWOR(startDate: Date, endDate: Date): number {
    console.log(`🔍 [TTWOR Debug] Starting TTWOR calculation for ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`)

    const startSnapshot = this.calculatePortfolioSnapshot(startDate)
    const endSnapshot = this.calculatePortfolioSnapshot(endDate)

    // Berechne das gesamte investierte Kapital über den Zeitraum
    const totalInvestedAmount = endSnapshot.totalInvested

    console.log(`🔍 [TTWOR Debug] Portfolio snapshots:`, {
      start: {
        date: startDate.toISOString().split('T')[0],
        totalValue: startSnapshot.totalValue,
        totalInvested: startSnapshot.totalInvested
      },
      end: {
        date: endDate.toISOString().split('T')[0],
        totalValue: endSnapshot.totalValue,
        totalInvested: endSnapshot.totalInvested
      },
      totalInvestedAmount
    })

    // Hole alle Investment-Transaktionen (Buy-Orders) im Zeitraum
    const investmentTransactions = this.transactions.filter(t =>
      t.date >= startDate && t.date <= endDate && t.type === 'buy'
    ).sort((a, b) => a.date.getTime() - b.date.getTime())

    console.log(`🔍 [TTWOR Debug] Found ${investmentTransactions.length} investment transactions`)

    if (investmentTransactions.length === 0 || totalInvestedAmount <= 0) {
      console.log(`📊 [TTWOR] No investments found - return 0`)
      return 0
    }

    // Berechne die gewichtete Performance für jede Position
    let totalWeightedReturn = 0
    let totalWeight = 0

    // Gruppiere Transaktionen nach Asset
    const assetTransactions = new Map<string, typeof investmentTransactions>()

    investmentTransactions.forEach(transaction => {
      if (!transaction.asset) return

      const assetKey = transaction.asset.isin || transaction.asset.wkn || transaction.asset.symbol || transaction.asset.name
      if (!assetKey) return

      if (!assetTransactions.has(assetKey)) {
        assetTransactions.set(assetKey, [])
      }
      assetTransactions.get(assetKey)!.push(transaction)
    })

    console.log(`🔍 [TTWOR Debug] Processing ${assetTransactions.size} unique assets`)

    // Berechne für jedes Asset die TTWOR
    assetTransactions.forEach((transactions, assetKey) => {
      const asset = this.assets.get(assetKey)
      if (!asset) return

      const firstTransactionDate = transactions[0].date
      const totalAssetInvestment = transactions.reduce((sum: number, t: ProcessedTransaction) => sum + Math.abs(t.amount), 0)

      // Hole Preise vom ersten Kauf und vom Ende
      const startPrice = this.getAssetPrice(asset.symbol, firstTransactionDate)
      const endPrice = this.getAssetPrice(asset.symbol, endDate)

      if (startPrice > 0 && endPrice > 0) {
        // Berechne die Performance dieses Assets
        const assetReturn = (endPrice - startPrice) / startPrice

        // Gewichte nach dem investierten Betrag
        const weight = totalAssetInvestment / totalInvestedAmount
        totalWeightedReturn += assetReturn * weight
        totalWeight += weight

        console.log(`📊 [TTWOR Debug] Asset ${asset.symbol}:`, {
          firstDate: firstTransactionDate.toISOString().split('T')[0],
          totalInvestment: totalAssetInvestment.toFixed(2),
          startPrice: startPrice.toFixed(2),
          endPrice: endPrice.toFixed(2),
          assetReturn: `${(assetReturn * 100).toFixed(2)}%`,
          weight: `${(weight * 100).toFixed(2)}%`,
          weightedContribution: `${(assetReturn * weight * 100).toFixed(2)}%`
        })
      }
    })

    // Falls wir eine gültige gewichtete Berechnung haben
    if (totalWeight > 0) {
      const ttwor = totalWeightedReturn / totalWeight;
      return ttwor * 100
    }

    // Fallback: Einfache Berechnung basierend auf Portfolio-Performance
    if (totalInvestedAmount > 0) {
      const simpleReturn = endSnapshot.performance / totalInvestedAmount

      console.log(`📊 [TTWOR] Fallback calculation: ${(simpleReturn * 100).toFixed(2)}%`)
      return simpleReturn
    }

    console.log(`📊 [TTWOR] No valid calculation possible - return 0`)
    return 0
  }

  /**
   * Calculate net cash flow (deposits - withdrawals) between two dates
   */
  private calculateNetCashFlow(startDate: Date, endDate: Date): number {
    let netCashFlow = 0

    // Portfolio transactions (dividends, interest, buy/sell)
    this.transactions
      .filter(t => t.date > startDate && t.date <= endDate)
      .forEach(transaction => {
        if (transaction.type === 'dividend' || transaction.type === 'interest') {
          netCashFlow += Math.abs(transaction.amount) - transaction.taxes
        } else if (transaction.type === 'buy') {
          // Buy transactions reduce cash (negative cash flow)
          netCashFlow -= Math.abs(transaction.amount) + transaction.fees + transaction.taxes
        } else if (transaction.type === 'sell') {
          // Sell transactions increase cash (positive cash flow)
          netCashFlow += Math.abs(transaction.amount) - transaction.fees - transaction.taxes
        }
      })

    // Cash transactions (deposits, withdrawals)
    this.cashTransactions
      .filter(t => t.date > startDate && t.date <= endDate)
      .forEach(transaction => {
        if (transaction.type === 'deposit') {
          netCashFlow += Math.abs(transaction.amount)
        } else if (transaction.type === 'withdrawal') {
          netCashFlow -= Math.abs(transaction.amount)
        }
      })

    return netCashFlow
  }
}
