'use client'

import { motion } from "framer-motion";
import {
	ArrowUpDown, BarChart3, Calculator, Calendar, Percent, PieChart, Settings, Target, TrendingDown,
	TrendingUp
} from "lucide-react";
import React, { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { formatCurrencyPrivate, usePrivacy } from "@/context/PrivacyContext";
import { formatPercentage } from "@/lib/formatters";
import { PerformanceData, PortfolioSummary } from "@/types/portfolio";

interface AnalysisProps {
  summary: PortfolioSummary
  performanceData: PerformanceData[]
  className?: string
}

interface AnalysisMetrics {
  // Performance Metrics
  ttwor: number // Time-Weighted Rate of Return
  irr: number // Internal Rate of Return
  cagr: number // Compound Annual Growth Rate

  // Cost Analysis
  totalTaxes: { amount: number; percentage: number }
  totalFees: { amount: number; percentage: number; avgPerOrder: number }

  // Return Analysis
  rawReturn: { amount: number; percentage: number }
  netReturn: { amount: number; percentage: number }
  realizedProfits: { amount: number; percentage: number }

  // Risk Metrics
  maxDrawdown: {
    oneMonth: number
    threeMonths: number
    sixMonths: number
    twelveMonths: number
    overall: number
  }
  volatility: number
  sharpeRatio: number

  // Future Projections
  expectedReturns: {
    min: number
    avg: number
    max: number
  }
  avgMonthlyContribution: number

  // Additional Metrics
  winRate: number
  profitFactor: number
  maxConsecutiveWins: number
  maxConsecutiveLosses: number
}

export const Analysis: React.FC<AnalysisProps> = ({
  summary,
  performanceData,
  className = ""
}) => {
  const { showAbsoluteValues } = usePrivacy()
  const [projectionYears, setProjectionYears] = useState([10])
  const [projectionReturnType, setProjectionReturnType] = useState<'avg' | 'conservative' | 'optimistic' | 'custom'>('avg')
  const [customReturnRate, setCustomReturnRate] = useState(7.0) // Default 7% annual return

  // Calculate comprehensive analytics
  const metrics = useMemo((): AnalysisMetrics => {
    if (!performanceData || performanceData.length === 0) {
      return {
        ttwor: 0, irr: 0, cagr: 0,
        totalTaxes: { amount: 0, percentage: 0 },
        totalFees: { amount: 0, percentage: 0, avgPerOrder: 0 },
        rawReturn: { amount: 0, percentage: 0 },
        netReturn: { amount: 0, percentage: 0 },
        realizedProfits: { amount: 0, percentage: 0 },
        maxDrawdown: { oneMonth: 0, threeMonths: 0, sixMonths: 0, twelveMonths: 0, overall: 0 },
        volatility: 0, sharpeRatio: 0,
        expectedReturns: { min: 0, avg: 0, max: 0 },
        avgMonthlyContribution: 0,
        winRate: 0, profitFactor: 0,
        maxConsecutiveWins: 0, maxConsecutiveLosses: 0
      }
    }

    const sortedData = [...performanceData].sort((a, b) => a.date.getTime() - b.date.getTime())
    const firstData = sortedData[0]
    const lastData = sortedData[sortedData.length - 1]

    // Time period in years
    const timeSpanDays = (lastData.date.getTime() - firstData.date.getTime()) / (1000 * 60 * 60 * 24)
    const timeSpanYears = timeSpanDays / 365.25

    // CAGR Calculation (annualized)
    const cagr = timeSpanYears > 0 ? Math.pow(lastData.portfolioValue / firstData.portfolioValue, 1 / timeSpanYears) - 1 : 0

    // TTWOR is now provided directly from the portfolio summary
    const ttwor = summary.ttwor || 0

    // Calculate returns
    const dailyReturns = []
    for (let i = 1; i < sortedData.length; i++) {
      const prevValue = sortedData[i - 1].portfolioValue
      const currentValue = sortedData[i].portfolioValue
      if (prevValue > 0) {
        dailyReturns.push((currentValue - prevValue) / prevValue)
      }
    }

    // Volatility (annualized standard deviation)
    const avgDailyReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length
    const volatility = Math.sqrt(variance * 252) // Annualized

    // Sharpe Ratio (assuming 2% risk-free rate)
    const riskFreeRate = 0.02
    const excessReturn = (cagr - riskFreeRate)
    const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0

    // Drawdown calculations
    const calculateMaxDrawdown = (data: PerformanceData[], months: number): number => {
      if (months === 0) {
        // Overall max drawdown
        let maxDrawdown = 0
        let peak = data[0]?.portfolioValue || 0

        data.forEach(point => {
          if (point.portfolioValue > peak) {
            peak = point.portfolioValue
          }
          const drawdown = (peak - point.portfolioValue) / peak
          maxDrawdown = Math.max(maxDrawdown, drawdown)
        })
        return maxDrawdown
      } else {
        // Period-specific drawdown
        const cutoffDate = new Date(lastData.date.getTime() - (months * 30 * 24 * 60 * 60 * 1000))
        const periodData = data.filter(d => d.date >= cutoffDate)
        return calculateMaxDrawdown(periodData, 0)
      }
    }

    // Win rate and profit factor
    const positiveReturns = dailyReturns.filter(r => r > 0)
    const negativeReturns = dailyReturns.filter(r => r < 0)
    const winRate = dailyReturns.length > 0 ? positiveReturns.length / dailyReturns.length : 0

    const totalPositive = positiveReturns.reduce((sum, r) => sum + r, 0)
    const totalNegative = Math.abs(negativeReturns.reduce((sum, r) => sum + r, 0))
    const profitFactor = totalNegative > 0 ? totalPositive / totalNegative : 0

    // Expected returns (based on historical performance)
    const monthlyReturns = []
    for (let i = 0; i < sortedData.length - 30; i += 30) {
      const startValue = sortedData[i].portfolioValue
      const endValue = sortedData[Math.min(i + 30, sortedData.length - 1)].portfolioValue
      if (startValue > 0) {
        monthlyReturns.push((endValue - startValue) / startValue)
      }
    }

    const sortedMonthlyReturns = monthlyReturns.sort((a, b) => a - b)
    const expectedReturns = {
      min: sortedMonthlyReturns[Math.floor(sortedMonthlyReturns.length * 0.1)] || 0, // 10th percentile
      avg: monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length || 0,
      max: sortedMonthlyReturns[Math.floor(sortedMonthlyReturns.length * 0.9)] || 0  // 90th percentile
    }

    // Average monthly contribution
    const totalContributions = lastData.invested - firstData.invested
    const totalMonths = timeSpanDays / 30.44 // Average days per month
    const avgMonthlyContribution = totalMonths > 0 ? totalContributions / totalMonths : 0

    // Calculate fees per transaction (estimated)
    const estimatedTransactions = Math.max(1, Math.floor(timeSpanDays / 30)) // Rough estimate
    const avgFeePerOrder = summary.totalFees / estimatedTransactions

    return {
      ttwor: ttwor, // Use the correct TTWOR from portfolio summary
      irr: cagr, // Simplified IRR (would need cash flow timing for precise calculation)
      cagr: cagr,

      totalTaxes: {
        amount: summary.totalTaxes,
        percentage: summary.totalInvested > 0 ? (summary.totalTaxes / summary.totalInvested) * 100 : 0
      },
      totalFees: {
        amount: summary.totalFees,
        percentage: summary.totalInvested > 0 ? (summary.totalFees / summary.totalInvested) * 100 : 0,
        avgPerOrder: avgFeePerOrder
      },

      rawReturn: {
        amount: summary.totalReturn + summary.totalTaxes,
        percentage: summary.totalInvested > 0 ? ((summary.totalReturn + summary.totalTaxes) / summary.totalInvested) * 100 : 0
      },
      netReturn: {
        amount: summary.totalReturn,
        percentage: summary.totalReturnPercentage
      },
      realizedProfits: {
        amount: summary.totalReturn, // Simplified - would need transaction analysis for precise calculation
        percentage: summary.totalReturnPercentage
      },

      maxDrawdown: {
        oneMonth: calculateMaxDrawdown(sortedData, 1) * 100,
        threeMonths: calculateMaxDrawdown(sortedData, 3) * 100,
        sixMonths: calculateMaxDrawdown(sortedData, 6) * 100,
        twelveMonths: calculateMaxDrawdown(sortedData, 12) * 100,
        overall: calculateMaxDrawdown(sortedData, 0) * 100,
      },
      volatility: volatility,
      sharpeRatio: sharpeRatio,

      expectedReturns: {
        min: expectedReturns.min * 12, // Annualized
        avg: expectedReturns.avg * 12,
        max: expectedReturns.max * 12
      },
      avgMonthlyContribution: avgMonthlyContribution,

      winRate: winRate * 100,
      profitFactor: profitFactor,
      maxConsecutiveWins: 0, // Would need detailed analysis
      maxConsecutiveLosses: 0
    }
  }, [summary, performanceData])

  // Future projection calculation using Zinseszins (compound interest) formula
  const futureProjection = useMemo(() => {
    const years = projectionYears[0]
    const monthlyContribution = metrics.avgMonthlyContribution

    // Determine the annual return rate based on selection
    let annualReturn: number
    switch (projectionReturnType) {
      case 'conservative':
        annualReturn = metrics.expectedReturns.min
        break
      case 'optimistic':
        annualReturn = metrics.expectedReturns.max
        break
      case 'custom':
        annualReturn = customReturnRate
        break
      case 'avg':
      default:
        annualReturn = metrics.expectedReturns.avg
        break
    }

    const monthlyReturn = annualReturn / 12 / 100 // Convert to monthly rate
    const currentValue = summary.totalValue
    const numberOfMonths = years * 12

    let futureValue = currentValue
    const totalContributions = monthlyContribution * numberOfMonths

    if (monthlyReturn !== 0 && !isNaN(monthlyReturn) && isFinite(monthlyReturn) && monthlyReturn > -1) {
      // Zinseszins formula: FV = PV × (1 + r)^n + PMT × [((1 + r)^n - 1) / r]

      // Part 1: Current value with compound interest
      const currentValueGrowth = currentValue * Math.pow(1 + monthlyReturn, numberOfMonths)

      // Part 2: Future value of monthly contributions (annuity formula)
      const contributionsGrowth = monthlyContribution * ((Math.pow(1 + monthlyReturn, numberOfMonths) - 1) / monthlyReturn)

      futureValue = currentValueGrowth + contributionsGrowth
    } else {
      // Fallback: no growth, just add contributions
      futureValue = currentValue + totalContributions
    }

    const capitalGains = futureValue - currentValue - totalContributions

    const result = {
      finalValue: futureValue,
      totalContributions,
      capitalGains,
      projectionRate: annualReturn
    }
    return result
  }, [projectionYears, projectionReturnType, customReturnRate, metrics, summary])

  const MetricCard: React.FC<{
    title: string
    value: React.ReactNode
    subtitle?: string
    icon: React.ReactNode
    trend?: 'up' | 'down' | 'neutral'
    className?: string
  }> = ({ title, value, subtitle, icon, trend, className = "" }) => (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`glass rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <div className={`p-1 rounded ${
          trend === 'up' ? 'bg-green-500/20 text-green-400' :
          trend === 'down' ? 'bg-red-500/20 text-red-400' :
          'bg-purple-500/20 text-purple-400'
        }`}>
          {icon}
        </div>
      </div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </motion.div>
  )

  return (
    <motion.div
      className={`space-y-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-purple-400" />
            <span>Portfolio Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Performance Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span>Performance Metrics</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="TTWOR (Time-Weighted Return)"
                value={formatPercentage(metrics.ttwor)}
                subtitle="Total for period"
                icon={<Target className="h-4 w-4" />}
                trend={metrics.ttwor > 0 ? 'up' : 'down'}
              />
              <MetricCard
                title="IRR (Internal Rate of Return)"
                value={formatPercentage(metrics.irr)}
                subtitle="Annualized"
                icon={<Calculator className="h-4 w-4" />}
                trend={metrics.irr > 0 ? 'up' : 'down'}
              />
              <MetricCard
                title="CAGR (Compound Annual Growth)"
                value={formatPercentage(metrics.cagr)}
                subtitle="Historical average"
                icon={<BarChart3 className="h-4 w-4" />}
                trend={metrics.cagr > 0 ? 'up' : 'down'}
              />
            </div>
          </div>

          {/* Return Analysis */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <PieChart className="h-4 w-4 text-blue-400" />
              <span>Return Analysis</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                title="Raw Return (Before Costs)"
                value={
                  <div className="space-y-1">
                    <div>{formatCurrencyPrivate(metrics.rawReturn.amount, showAbsoluteValues)}</div>
                    <div className="text-sm">{formatPercentage(metrics.rawReturn.percentage)}</div>
                  </div>
                }
                icon={<TrendingUp className="h-4 w-4" />}
                trend={metrics.rawReturn.amount > 0 ? 'up' : 'down'}
              />
              <MetricCard
                title="Net Return (After Costs)"
                value={
                  <div className="space-y-1">
                    <div>{formatCurrencyPrivate(metrics.netReturn.amount, showAbsoluteValues)}</div>
                    <div className="text-sm">{formatPercentage(metrics.netReturn.percentage)}</div>
                  </div>
                }
                icon={<Calculator className="h-4 w-4" />}
                trend={metrics.netReturn.amount > 0 ? 'up' : 'down'}
              />
              <MetricCard
                title="Realized Profits"
                value={
                  <div className="space-y-1">
                    <div>{formatCurrencyPrivate(metrics.realizedProfits.amount, showAbsoluteValues)}</div>
                    <div className="text-sm">{formatPercentage(metrics.realizedProfits.percentage)}</div>
                  </div>
                }
                icon={<Target className="h-4 w-4" />}
                trend={metrics.realizedProfits.amount > 0 ? 'up' : 'down'}
              />
            </div>
          </div>

          {/* Cost Analysis */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span>Cost Analysis</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard
                title="Total Taxes"
                value={
                  <div className="space-y-1">
                    <div>{formatCurrencyPrivate(metrics.totalTaxes.amount, showAbsoluteValues)}</div>
                    <div className="text-sm">{formatPercentage(metrics.totalTaxes.percentage)} of invested</div>
                  </div>
                }
                icon={<Percent className="h-4 w-4" />}
                trend="down"
              />
              <MetricCard
                title="Total Fees"
                value={
                  <div className="space-y-1">
                    <div>{formatCurrencyPrivate(metrics.totalFees.amount, showAbsoluteValues)}</div>
                    <div className="text-sm">{formatPercentage(metrics.totalFees.percentage)} of invested</div>
                    <div className="text-xs text-gray-500">
                      Avg: {formatCurrencyPrivate(metrics.totalFees.avgPerOrder, showAbsoluteValues)} per order
                    </div>
                  </div>
                }
                icon={<Calculator className="h-4 w-4" />}
                trend="down"
              />
            </div>
          </div>

          {/* Risk Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <ArrowUpDown className="h-4 w-4 text-orange-400" />
              <span>Risk Analysis</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Max Drawdown (1M)"
                value={formatPercentage(metrics.maxDrawdown.oneMonth)}
                subtitle="1 month period"
                icon={<TrendingDown className="h-4 w-4" />}
                trend="down"
              />
              <MetricCard
                title="Max Drawdown (3M)"
                value={formatPercentage(metrics.maxDrawdown.threeMonths)}
                subtitle="3 month period"
                icon={<TrendingDown className="h-4 w-4" />}
                trend="down"
              />
              <MetricCard
                title="Max Drawdown (6M)"
                value={formatPercentage(metrics.maxDrawdown.sixMonths)}
                subtitle="6 month period"
                icon={<TrendingDown className="h-4 w-4" />}
                trend="down"
              />
              <MetricCard
                title="Max Drawdown (12M)"
                value={formatPercentage(metrics.maxDrawdown.twelveMonths)}
                subtitle="12 month period"
                icon={<TrendingDown className="h-4 w-4" />}
                trend="down"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <MetricCard
                title="Overall Max Drawdown"
                value={formatPercentage(metrics.maxDrawdown.overall)}
                subtitle="Historical maximum"
                icon={<TrendingDown className="h-4 w-4" />}
                trend="down"
              />
              <MetricCard
                title="Volatility"
                value={formatPercentage(metrics.volatility)}
                subtitle="Annualized standard deviation"
                icon={<ArrowUpDown className="h-4 w-4" />}
                trend="neutral"
              />
              <MetricCard
                title="Sharpe Ratio"
                value={metrics.sharpeRatio.toFixed(2)}
                subtitle="Risk-adjusted return"
                icon={<Target className="h-4 w-4" />}
                trend={metrics.sharpeRatio > 1 ? 'up' : 'neutral'}
              />
            </div>
          </div>

          {/* Expected Returns */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <Target className="h-4 w-4 text-green-400" />
              <span>Expected Future Returns</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <MetricCard
                title="Conservative (10th percentile)"
                value={formatPercentage(metrics.expectedReturns.min)}
                subtitle="Based on historical performance"
                icon={<TrendingDown className="h-4 w-4" />}
                trend="neutral"
              />
              <MetricCard
                title="Expected (Average)"
                value={formatPercentage(metrics.expectedReturns.avg)}
                subtitle="Historical average"
                icon={<Target className="h-4 w-4" />}
                trend="up"
              />
              <MetricCard
                title="Optimistic (90th percentile)"
                value={formatPercentage(metrics.expectedReturns.max)}
                subtitle="Based on historical performance"
                icon={<TrendingUp className="h-4 w-4" />}
                trend="up"
              />
            </div>
            <MetricCard
              title="Average Monthly Contribution"
              value={formatCurrencyPrivate(metrics.avgMonthlyContribution, showAbsoluteValues)}
              subtitle="Historical average based on portfolio growth"
              icon={<Calendar className="h-4 w-4" />}
              trend="up"
              className="max-w-md"
            />
          </div>

          {/* Future Projection */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              <span>Future Projection</span>
            </h3>
            <div className="glass rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-400">Projection Period: {projectionYears[0]} years</label>
                <span className="text-xs text-gray-500">1Y - 50Y</span>
              </div>
              <Slider
                value={projectionYears}
                onValueChange={setProjectionYears}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />

              {/* Return Rate Selection */}
              <div className="space-y-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4 text-gray-400" />
                  <label className="text-sm font-medium text-gray-400">Expected Annual Return:</label>
                </div>

                {/* Return Type Selector */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setProjectionReturnType('conservative')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      projectionReturnType === 'conservative'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-600/50'
                    }`}
                  >
                    Conservative ({formatPercentage(metrics.expectedReturns.min)})
                  </button>
                  <button
                    onClick={() => setProjectionReturnType('avg')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      projectionReturnType === 'avg'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-600/50'
                    }`}
                  >
                    Average ({formatPercentage(metrics.expectedReturns.avg)})
                  </button>
                  <button
                    onClick={() => setProjectionReturnType('optimistic')}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      projectionReturnType === 'optimistic'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-600/50'
                    }`}
                  >
                    Optimistic ({formatPercentage(metrics.expectedReturns.max)})
                  </button>
                  <button
                    onClick={() => {
                      setProjectionReturnType('custom')
                      // Initialize custom rate to historical average when switching to custom mode
                      if (projectionReturnType !== 'custom') {
                        setCustomReturnRate(Math.max(0, metrics.expectedReturns.avg))
                      }
                    }}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      projectionReturnType === 'custom'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:bg-gray-600/50'
                    }`}
                  >
                    Custom ({formatPercentage(customReturnRate)})
                  </button>
                </div>

                {/* Custom Return Rate Input */}
                {projectionReturnType === 'custom' && (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-400">Custom Annual Return</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={customReturnRate}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value)
                          if (!isNaN(value)) {
                            setCustomReturnRate(value)
                          }
                        }}
                        min="-50"
                        max="100"
                        step="0.1"
                        className="w-20 px-3 py-1 bg-gray-700/50 border border-gray-600/30 rounded text-white text-sm focus:outline-none focus:border-purple-500/50 focus:bg-gray-600/50"
                        placeholder="7.0"
                      />
                      <span className="text-sm text-gray-400">% annually</span>
                    </div>
                  </div>
                )}

                {/* Current Selection Display */}
                <div className="flex items-center justify-center space-x-2 pt-2 border-t border-gray-700/50">
                  <div className="text-sm text-gray-400">Using return rate:</div>
                  <div className="text-sm font-medium text-blue-400">
                    {formatPercentage(futureProjection.projectionRate)} annually
                  </div>
                  <div className="text-xs text-gray-500">
                    ({projectionReturnType === 'avg' ? 'historical average' :
                      projectionReturnType === 'conservative' ? '10th percentile' :
                      projectionReturnType === 'optimistic' ? '90th percentile' :
                      'custom rate'})
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {formatCurrencyPrivate(futureProjection.finalValue, showAbsoluteValues)}
                  </div>
                  <div className="text-sm text-gray-400">Projected Portfolio Value</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {formatCurrencyPrivate(futureProjection.totalContributions, showAbsoluteValues)}
                  </div>
                  <div className="text-sm text-gray-400">Total Contributions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {formatCurrencyPrivate(futureProjection.capitalGains, showAbsoluteValues)}
                  </div>
                  <div className="text-sm text-gray-400">Expected Capital Gains</div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Performance Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-yellow-400" />
              <span>Additional Metrics</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricCard
                title="Win Rate"
                value={formatPercentage(metrics.winRate)}
                subtitle="Percentage of positive periods"
                icon={<Target className="h-4 w-4" />}
                trend={metrics.winRate > 0.5 ? 'up' : 'down'}
              />
              <MetricCard
                title="Profit Factor"
                value={metrics.profitFactor.toFixed(2)}
                subtitle="Ratio of total gains to total losses"
                icon={<Calculator className="h-4 w-4" />}
                trend={metrics.profitFactor > 1 ? 'up' : 'down'}
              />
            </div>
          </div>

        </CardContent>
      </Card>
    </motion.div>
  )
}
