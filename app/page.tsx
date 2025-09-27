'use client'

import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Calendar, Eye, EyeOff, FileText, Save, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import { Analysis } from "@/components/Analysis";
import { AssetAllocation } from "@/components/AssetAllocation";
import {
	AssetFetchingProgress, PortfolioFetchingProgress
} from "@/components/AssetFetchingProgress";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import { DeleteDataDialog } from "@/components/DeleteDataDialog";
import { FileUpload } from "@/components/FileUpload";
import { MonthlyFlowMatrix } from "@/components/MonthlyFlowMatrix";
import { PerformanceChart } from "@/components/PerformanceChart";
import { PortfolioSelector } from "@/components/PortfolioSelector";
import { PortfolioSummaryComponent } from "@/components/PortfolioSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrivacyProvider, usePrivacy } from "@/context/PrivacyContext";
import { PortfolioManager } from "@/lib/portfolioCalculations";
import {
	clearPortfolioStorage, getStorageInfo, loadPortfoliosFromStorage, savePortfoliosToStorage
} from "@/lib/storage";
import { PerformanceData, Portfolio, PortfolioSummary } from "@/types/portfolio";

// Helper function to aggregate performance data from multiple portfolios
const aggregatePerformanceData = (managers: PortfolioManager[], startDate: Date, endDate: Date): PerformanceData[] => {
  // Get all performance data arrays
  const allPerformanceData = managers.map(manager => {
    const summary = manager.calculateSummary(startDate, endDate)
    return summary.performance
  })

  if (allPerformanceData.length === 0 || allPerformanceData.every(data => data.length === 0)) {
    return []
  }

  // Find all unique dates across all portfolios
  const allDates = new Set<string>()
  allPerformanceData.forEach(performanceArray => {
    performanceArray.forEach(item => {
      allDates.add(item.date.toISOString().split('T')[0])
    })
  })

  // Sort dates
  const sortedDates = Array.from(allDates).sort()

  // Aggregate data for each date
  const aggregatedPerformance: PerformanceData[] = sortedDates.map(dateStr => {
    const date = new Date(dateStr)
    let totalPortfolioValue = 0
    let totalInvested = 0
    let totalCash = 0
    let totalReturn = 0
    let totalTaxes = 0
    let validDataPoints = 0

    // Sum values from all portfolios for this date
    allPerformanceData.forEach((performanceArray, portfolioIndex) => {
      if (performanceArray.length === 0) return

      // Find exact match first
      let dataPoint = performanceArray.find(item =>
        item.date.toISOString().split('T')[0] === dateStr
      )

      // If no exact match, find the closest available data point
      if (!dataPoint) {
        // Find the last data point before or on this date
        const validPoints = performanceArray.filter(item =>
          item.date <= date
        ).sort((a, b) => b.date.getTime() - a.date.getTime())

        dataPoint = validPoints[0] // Most recent data before this date
      }

      if (dataPoint) {
        totalPortfolioValue += dataPoint.portfolioValue
        totalInvested += dataPoint.invested
        totalCash += dataPoint.cash
        totalReturn += dataPoint.return
        totalTaxes += dataPoint.taxes
        validDataPoints++
      }
    })

    // Only include dates where we have at least one data point
    if (validDataPoints === 0) {
      return null
    }

    // Calculate aggregated percentages
    const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0
    const afterTaxReturn = totalReturn - totalTaxes
    const afterTaxReturnPercentage = totalInvested > 0 ? (afterTaxReturn / totalInvested) * 100 : 0

    return {
      date,
      portfolioValue: totalPortfolioValue,
      invested: totalInvested,
      cash: totalCash,
      return: totalReturn,
      returnPercentage,
      taxes: totalTaxes,
      afterTaxReturn,
      afterTaxReturnPercentage
    }
  }).filter(Boolean) as PerformanceData[] // Remove null entries

  console.log(`📊 [Aggregation] Performance data for ${managers.length} portfolios:`, {
    totalDataPoints: aggregatedPerformance.length,
    dateRange: aggregatedPerformance.length > 0 ?
      `${aggregatedPerformance[0].date.toISOString().split('T')[0]} to ${aggregatedPerformance[aggregatedPerformance.length - 1].date.toISOString().split('T')[0]}` : 'No data',
    sampleData: aggregatedPerformance.slice(0, 3)
  })

  return aggregatedPerformance
}

// Helper function to aggregate multiple portfolio summaries
const aggregatePortfolioSummaries = (managers: PortfolioManager[], startDate: Date, endDate: Date): PortfolioSummary => {
  const summaries = managers.map(manager => manager.calculateSummary(startDate, endDate))

  // Create a combined PortfolioManager to calculate proper TTWOR
  const combinedManager = PortfolioManager.createCombinedManager(managers)
  const combinedTTWOR = combinedManager.calculateTTWOR(startDate, endDate)

  const totalInvestedAll = summaries.reduce((sum, s) => sum + s.totalInvested, 0)

  // Aggregate all numeric values
  const aggregated: PortfolioSummary = {
    totalValue: summaries.reduce((sum, s) => sum + s.totalValue, 0),
    totalInvested: totalInvestedAll,
    totalReturn: summaries.reduce((sum, s) => sum + s.totalReturn, 0),
    totalReturnPercentage: 0, // Will calculate below
    totalCash: summaries.reduce((sum, s) => sum + s.totalCash, 0),
    totalDividends: summaries.reduce((sum, s) => sum + s.totalDividends, 0),
    totalInterest: summaries.reduce((sum, s) => sum + s.totalInterest, 0),
    totalFees: summaries.reduce((sum, s) => sum + s.totalFees, 0),
    totalTaxes: summaries.reduce((sum, s) => sum + s.totalTaxes, 0),
    ttwor: combinedTTWOR,
    assetAllocation: {} as { [symbol: string]: number },
    performance: aggregatePerformanceData(managers, startDate, endDate), // NEW: Aggregate performance data
    positions: [] // Will aggregate below
  }

  // Calculate percentage after aggregation
  aggregated.totalReturnPercentage = aggregated.totalInvested > 0
    ? (aggregated.totalReturn / aggregated.totalInvested) * 100
    : 0

  // Aggregate asset allocations and positions
  const positionMap = new Map<string, any>()

  summaries.forEach(summary => {
    Object.entries(summary.assetAllocation).forEach(([symbol, value]) => {
      aggregated.assetAllocation[symbol] = (aggregated.assetAllocation[symbol] || 0) + value
    })

    // Aggregate positions by symbol
    summary.positions.forEach(position => {
      if (positionMap.has(position.symbol)) {
        const existing = positionMap.get(position.symbol)
        existing.shares += position.shares
        existing.totalCost += position.totalCost
        existing.currentValue += position.currentValue
        existing.unrealizedGain += position.unrealizedGain
        // Recalculate averages
        existing.averagePrice = existing.totalCost / existing.shares
        existing.unrealizedGainPercent = existing.totalCost > 0 ? (existing.unrealizedGain / existing.totalCost) * 100 : 0
      } else {
        positionMap.set(position.symbol, { ...position })
      }
    })
  })

  // Convert position map to array and recalculate weights
  aggregated.positions = Array.from(positionMap.values())
  aggregated.positions.forEach(position => {
    position.weight = aggregated.totalValue > 0 ? (position.currentValue / aggregated.totalValue) * 100 : 0
  })

  return aggregated
}

// Global Privacy Toggle Component
const GlobalPrivacyToggle: React.FC = () => {
  const { showAbsoluteValues, togglePrivacy } = usePrivacy()

  return (
    <Button
      variant="glass"
      size="sm"
      onClick={togglePrivacy}
      className="text-purple-400 hover:text-purple-300"
      title={showAbsoluteValues ? "Hide absolute values" : "Show absolute values"}
    >
      {showAbsoluteValues ? (
        <>
          <EyeOff className="h-4 w-4 mr-2" />
          Hide Values
        </>
      ) : (
        <>
          <Eye className="h-4 w-4 mr-2" />
          Show Values
        </>
      )}
    </Button>
  )
}

const Dashboard: React.FC = () => {
  // Store portfolio managers separately (not serialized to localStorage)
  const [portfolioManagers] = useState(() => new Map<string, PortfolioManager>())

  // Portfolio state
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState<string[]>([])
  const [hasData, setHasData] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // UI state
  const [includeTax, setIncludeTax] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [storageInfo, setStorageInfo] = useState<{
    hasData: boolean;
    timestamp?: string;
    portfolioCount?: number;
    sizeKB?: number;
  }>({ hasData: false })

  // Progress tracking state
  const [fetchingProgress, setFetchingProgress] = useState<PortfolioFetchingProgress | null>(null)
  const [showProgress, setShowProgress] = useState(false)
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    end: new Date()
  })
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)

  // Load data from localStorage on component mount
  useEffect(() => {
    const storedData = loadPortfoliosFromStorage()
    if (storedData) {
      setPortfolios(storedData.portfolios)
      setSelectedPortfolioIds(storedData.selectedPortfolioIds)
      setHasData(true)

      // Recreate portfolio managers from stored data
      const recreateManagers = async () => {
        const portfoliosNeedingPrices: Portfolio[] = []

        for (const portfolio of storedData.portfolios) {
          const manager = new PortfolioManager()

          // Load transactions without fetching price data initially
          await manager.loadTransactions(
            portfolio.data.transactions,
            portfolio.data.cashTransactions,
            undefined, // No progress callback = no price fetching
            portfolio.name
          )

          // Check if we have historical prices cached
          if (portfolio.data.historicalPrices && Object.keys(portfolio.data.historicalPrices).length > 0) {
            manager.importHistoricalPrices(portfolio.data.historicalPrices)
            console.log(`📊 [Dashboard] Restored historical prices for ${portfolio.name}`)
          } else {
            console.log(`⚠️ [Dashboard] No cached prices for ${portfolio.name}, will need to fetch`)
            portfoliosNeedingPrices.push(portfolio)
          }

          portfolioManagers.set(portfolio.id, manager)
        }

        // If some portfolios need price data, fetch it with loading state
        if (portfoliosNeedingPrices.length > 0) {
          console.log(`🌐 [Dashboard] Fetching missing price data for ${portfoliosNeedingPrices.length} portfolios`)
          setIsLoading(true)
          setShowProgress(true)

          try {
            for (const portfolio of portfoliosNeedingPrices) {
              const manager = portfolioManagers.get(portfolio.id)
              if (manager) {
                // Progress callback for missing price fetching
                const progressCallback = (progress: PortfolioFetchingProgress) => {
                  setFetchingProgress(progress)
                }

                // Re-load with price fetching this time
                await manager.loadTransactions(
                  portfolio.data.transactions,
                  portfolio.data.cashTransactions,
                  progressCallback,
                  `${portfolio.name} (missing prices)`
                )

                // Update the portfolio with fetched prices
                const updatedPortfolio = {
                  ...portfolio,
                  data: {
                    ...portfolio.data,
                    historicalPrices: manager.exportHistoricalPrices()
                  }
                }

                // Update the portfolios array
                setPortfolios(prev => prev.map(p => p.id === portfolio.id ? updatedPortfolio : p))
              }
            }
          } finally {
            setIsLoading(false)
            setTimeout(() => {
              setShowProgress(false)
              setFetchingProgress(null)
            }, 2000)
          }
        }

        console.log(`⚡ [Dashboard] Recreated ${storedData.portfolios.length} portfolio managers`)
      }

      recreateManagers()

      // Set date range to cover all loaded portfolios
      if (storedData.portfolios.length > 0) {
        const allStartDates = storedData.portfolios.map(p => p.data.startDate)
        const allEndDates = storedData.portfolios.map(p => p.data.endDate)
        const overallStart = new Date(Math.min(...allStartDates.map(d => d.getTime())))
        const overallEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())))

        setDateRange({ start: overallStart, end: overallEnd })
        console.log(`📅 [Dashboard] Restored date range: ${overallStart.toISOString().split('T')[0]} to ${overallEnd.toISOString().split('T')[0]}`)
      }

      console.log(`📂 [Dashboard] Restored ${storedData.portfolios.length} portfolios from localStorage`)
    }

    // Update storage info
    setStorageInfo(getStorageInfo())
  }, [])

  // Save data to localStorage whenever portfolios or selection changes
  useEffect(() => {
    if (portfolios.length > 0) {
      savePortfoliosToStorage(portfolios, selectedPortfolioIds)
      setStorageInfo(getStorageInfo()) // Update storage info after saving
    }
  }, [portfolios, selectedPortfolioIds])

  // Handle new portfolios from CSV upload
  const handlePortfoliosCreated = useCallback(async (newPortfolios: Portfolio[]) => {
    console.log(`🚀 [Dashboard] Processing ${newPortfolios.length} new portfolios`)
    setIsLoading(true)
    setShowProgress(true)

    try {
      // Process each portfolio with PortfolioManager
      const processedPortfolios: Portfolio[] = []

      for (const portfolio of newPortfolios) {
        console.log(`📊 [Dashboard] Processing portfolio: ${portfolio.name}`)

        // Create a new portfolio manager instance for this portfolio
        const manager = new PortfolioManager()

        // Progress callback for asset fetching
        const progressCallback = (progress: PortfolioFetchingProgress) => {
          setFetchingProgress(progress)
        }

        await manager.loadTransactions(
          portfolio.data.transactions,
          portfolio.data.cashTransactions,
          progressCallback,
          portfolio.name
        )

        // Store the manager for reuse (avoids refetching on date range changes)
        portfolioManagers.set(portfolio.id, manager)

        const dataRange = manager.getDateRange()
        const summary = manager.calculateSummary(dataRange.start, dataRange.end)

        const processedPortfolio: Portfolio = {
          ...portfolio,
          data: {
            ...portfolio.data,
            startDate: dataRange.start,
            endDate: dataRange.end,
            historicalPrices: manager.exportHistoricalPrices() // Store prices for cache
          },
          summary
        }

        processedPortfolios.push(processedPortfolio)
      }

      setPortfolios(prev => [...prev, ...processedPortfolios])
      setSelectedPortfolioIds(prev => [...prev, ...processedPortfolios.map(p => p.id)])
      setHasData(true)

      // Set date range to cover all portfolios
      if (processedPortfolios.length > 0) {
        const allStartDates = processedPortfolios.map(p => p.data.startDate)
        const allEndDates = processedPortfolios.map(p => p.data.endDate)
        const overallStart = new Date(Math.min(...allStartDates.map(d => d.getTime())))
        const overallEnd = new Date(Math.max(...allEndDates.map(d => d.getTime())))

        setDateRange({ start: overallStart, end: overallEnd })
        console.log(`📅 [Dashboard] Set date range: ${overallStart.toISOString().split('T')[0]} to ${overallEnd.toISOString().split('T')[0]}`)
      }

      console.log(`🎉 [Dashboard] Successfully processed ${processedPortfolios.length} portfolios`)
    } catch (error) {
      console.error('❌ [Dashboard] Error processing portfolios:', error)
    } finally {
      setIsLoading(false)
      // Hide progress after a short delay to show completion
      setTimeout(() => {
        setShowProgress(false)
        setFetchingProgress(null)
      }, 2000)
    }
  }, [])

  // Handle portfolio selection changes
  const handlePortfolioSelection = useCallback((newSelectedIds: string[]) => {
    setSelectedPortfolioIds(newSelectedIds)
  }, [])

  // Handle delete all data
  const handleDeleteAllData = useCallback(() => {
    clearPortfolioStorage()
    setPortfolios([])
    setSelectedPortfolioIds([])
    setPortfolioSummary(null)
    setHasData(false)
    portfolioManagers.clear() // Clear cached managers
    setStorageInfo(getStorageInfo()) // Update storage info after clearing
    console.log('🗑️ [Dashboard] All portfolio data deleted')
  }, [portfolioManagers])

  // Handle date range changes with loading state for heavy calculations
  const handleDateRangeChange = useCallback(async (start: Date, end: Date) => {
    setDateRange({ start, end })

    if (selectedPortfolioIds.length === 0) {
      return
    }

    // Show loading for aggregated portfolios (can be slow)
    if (selectedPortfolioIds.length > 1) {
      setIsLoading(true)
    }

    try {
      if (selectedPortfolioIds.length === 1) {
        // Single portfolio - should be fast
        const portfolioId = selectedPortfolioIds[0]
        const manager = portfolioManagers.get(portfolioId)

        if (manager) {
          const summary = manager.calculateSummary(start, end)
          setPortfolioSummary(summary)
          console.log(`⚡ [Dashboard] Summary update for date range: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`)
        }
      } else {
        // Multiple portfolios - can be slow, run async
        const selectedManagers = selectedPortfolioIds
          .map(id => portfolioManagers.get(id))
          .filter(Boolean) as PortfolioManager[]

        if (selectedManagers.length > 0) {
          // Use setTimeout to allow UI to update loading state
          await new Promise(resolve => setTimeout(resolve, 10))

          const aggregatedSummary = aggregatePortfolioSummaries(selectedManagers, start, end)
          setPortfolioSummary(aggregatedSummary)
          console.log(`⚡ [Dashboard] Aggregated summary for ${selectedManagers.length} portfolios: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`)
        }
      }
    } catch (error) {
      console.error('❌ [Dashboard] Error updating summary for date range:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedPortfolioIds, portfolioManagers])

  // Calculate aggregated summary for selected portfolios
  useEffect(() => {
    if (selectedPortfolioIds.length === 0) {
      setPortfolioSummary(null)
      return
    }

    // Trigger date range calculation when selection changes
    handleDateRangeChange(dateRange.start, dateRange.end)
  }, [portfolios, selectedPortfolioIds, dateRange.start, dateRange.end, handleDateRangeChange])

  return (
    <PrivacyProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark border-b border-white/10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-3"
            >
              <div className="p-2 rounded-lg bg-purple-500/20">
                <BarChart3 className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Portfolio Dashboard</h1>
                <p className="text-sm text-gray-400">Advanced portfolio analysis & visualization</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-2"
            >
              {/* Global Privacy Toggle */}
              <GlobalPrivacyToggle />

              {hasData && (
                <>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => savePortfoliosToStorage(portfolios, selectedPortfolioIds)}
                    className="text-green-400 hover:text-green-300"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Data
                  </Button>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {!hasData ? (
            // Initial Upload State
            <motion.div
              key="upload"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="mx-auto w-fit p-4 rounded-full bg-purple-500/20 mb-4"
                >
                  <FileText className="h-12 w-12 text-purple-400" />
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Welcome to Your Portfolio Dashboard
                </h2>
                <p className="text-gray-400 max-w-2xl mx-auto">
                  Upload your Portfolio Performance CSV exports to get started with advanced
                  portfolio analysis, performance tracking, and beautiful visualizations.
                </p>
              </div>

              <FileUpload
                onPortfoliosCreated={handlePortfoliosCreated}
                className="max-w-2xl mx-auto"
              />

              {/* Asset Fetching Progress - Initial Upload */}
              <div className="mt-8 max-w-4xl mx-auto">
                <AssetFetchingProgress
                  progress={fetchingProgress}
                  isVisible={showProgress}
                />
              </div>

               {isLoading && !showProgress && (
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="mt-8 text-center space-y-4"
                 >
                   <div className="inline-flex items-center space-x-2 glass rounded-full px-6 py-3">
                     <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                     <span className="text-white">Processing portfolio data...</span>
                   </div>
                   <div className="glass rounded-lg p-4 max-w-md mx-auto">
                     <p className="text-sm text-gray-300 mb-2">🔍 Parsing CSV files</p>
                     <p className="text-sm text-gray-300 mb-2">🌐 Fetching data from Yahoo Finance</p>
                     <p className="text-sm text-gray-300 mb-2">📊 Calculating portfolio metrics</p>
                     <p className="text-xs text-gray-400">Check browser console for detailed progress</p>
                   </div>
                 </motion.div>
               )}
            </motion.div>
          ) : (
            // Dashboard State
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Portfolio Selection and Date Range - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Portfolio Selection */}
                {portfolios.length > 0 && (
                  <PortfolioSelector
                    portfolios={portfolios}
                    selectedPortfolioIds={selectedPortfolioIds}
                    onSelectionChange={handlePortfolioSelection}
                  />
                )}

                {/* Date Range Selector */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-purple-400" />
                      <CardTitle>Time Period</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <DateRangeSelector
                      startDate={dateRange.start}
                      endDate={dateRange.end}
                      maxDate={portfolios.length > 0
                        ? new Date(Math.max(...portfolios.map(p => p.data.endDate.getTime())))
                        : new Date()
                      }
                      minDate={portfolios.length > 0
                        ? new Date(Math.min(...portfolios.map(p => p.data.startDate.getTime())))
                        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                      }
                      onDateRangeChange={handleDateRangeChange}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Portfolio Summary */}
              {portfolioSummary && (
                <PortfolioSummaryComponent
                  summary={portfolioSummary}
                  includeTax={includeTax}
                  onTaxToggle={setIncludeTax}
                />
              )}

              {/* Performance Chart */}
              {portfolioSummary && (
                <PerformanceChart
                  data={portfolioSummary.performance}
                  title="Portfolio Performance Over Time"
                  includeTax={includeTax}
                  onTaxToggle={setIncludeTax}
                />
              )}

              {/* Asset Allocation */}
              {portfolioSummary && (
                <AssetAllocation positions={portfolioSummary.positions} />
              )}

              {/* Analysis Section */}
              {portfolioSummary && (
                <Analysis
                  summary={portfolioSummary}
                  performanceData={portfolioSummary.performance}
                />
              )}

              {/* Monthly Cash Flow Matrix */}
              {portfolioSummary && (
                <MonthlyFlowMatrix performanceData={portfolioSummary.performance} />
              )}

              {/* Add More Data Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-purple-400" />
                      <span>Add More Portfolio Data</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-400 mb-4">
                      Upload additional CSV files to add more portfolios or extend your existing data.
                    </p>
                    <FileUpload
                      onPortfoliosCreated={handlePortfoliosCreated}
                      className="max-w-full"
                    />

                    {/* Asset Fetching Progress */}
                    <div className="mt-4">
                      <AssetFetchingProgress
                        progress={fetchingProgress}
                        isVisible={showProgress}
                      />
                    </div>

                    {isLoading && !showProgress && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-4 text-center"
                      >
                        <div className="inline-flex items-center space-x-2 glass rounded-full px-4 py-2">
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                          <span className="text-white text-sm">Processing new data...</span>
                        </div>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete Data Dialog */}
      <DeleteDataDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteAllData}
        portfolioCount={portfolios.length}
        storageSize={storageInfo.sizeKB}
      />
      </div>
    </PrivacyProvider>
  )
}

export default Dashboard
