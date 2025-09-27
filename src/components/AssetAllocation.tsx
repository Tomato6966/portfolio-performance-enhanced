'use client'

import { motion } from "framer-motion";
import { Check, Copy, PieChart, TrendingDown, TrendingUp } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyPrivate, usePrivacy } from "@/context/PrivacyContext";
import { formatPercentage } from "@/lib/formatters";
import { PortfolioPosition } from "@/lib/portfolioCalculations";

interface AssetAllocationProps {
  positions: PortfolioPosition[]
  className?: string
}

interface EnhancedPosition extends PortfolioPosition {
  displayName: string
  identifiers: string[]
}

// Custom Tooltip Component
const AllocationTooltip: React.FC<{
  position: EnhancedPosition
  index: number
  isVisible: boolean
  x: number
  y: number
}> = ({ position, index, isVisible, x, y }) => {
  const { showAbsoluteValues } = usePrivacy()

  if (!isVisible) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
      className="fixed z-50 pointer-events-none"
      style={{ left: x, top: y }}
    >
      <div className="glass-dark rounded-lg p-3 shadow-xl border border-white/10 min-w-[200px]">
        <div className="flex items-center space-x-2 mb-2">
          <div className={`w-3 h-3 rounded-full bg-purple-500`} />
          <h4 className="font-medium text-white text-sm truncate">
            {position.displayName}
          </h4>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Weight:</span>
            <span className="text-white font-medium">{formatPercentage(position.weight)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Value:</span>
            <span className="text-white font-medium">
              {formatCurrencyPrivate(position.currentValue, showAbsoluteValues)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Invested:</span>
            <span className="text-white font-medium">
              {formatCurrencyPrivate(position.totalCost, showAbsoluteValues)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">P/L:</span>
            <span className={`font-medium ${
              position.unrealizedGain >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatCurrencyPrivate(position.unrealizedGain, showAbsoluteValues)} ({formatPercentage(position.unrealizedGainPercent)})
            </span>
          </div>
          {position.symbol && (
            <div className="flex justify-between">
              <span className="text-gray-400">Symbol:</span>
              <span className="text-purple-300 font-medium">{position.symbol}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

const getPositionColor = (index: number): string => {
    const colors = [
      'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
      'bg-indigo-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-emerald-500'
    ]
    return colors[index % colors.length]
  }

const getPositionTextColor = (index: number): string => {
    const colors = [
        'text-purple-400', 'text-blue-400', 'text-green-400', 'text-yellow-400', 'text-red-400',
        'text-indigo-400', 'text-pink-400', 'text-cyan-400', 'text-orange-400', 'text-emerald-400'
    ]
    return colors[index % colors.length]
}

export const AssetAllocation: React.FC<AssetAllocationProps> = ({
  positions,
  className = ""
}) => {
  const { showAbsoluteValues } = usePrivacy()
  const [hoveredPosition, setHoveredPosition] = useState<{
    position: EnhancedPosition
    index: number
    x: number
    y: number
  } | null>(null)
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set())

  // Filter and enhance positions
  const activePositions = useMemo((): EnhancedPosition[] => {
    return positions
      .filter(position => position.currentValue >= 1) // Only show positions > 1 EUR
      .map(position => {
        // Create display name with all available identifiers
        const identifiers = []
        if (position.symbol) identifiers.push(position.symbol)
        if (position.isin) identifiers.push(`ISIN: ${position.isin}`)
        // Add WKN when available (would need to be added to PortfolioPosition interface)

        const displayName = position.name || position.symbol || 'Unknown Asset'
        const identifierString = identifiers.join(', ')

        return {
          ...position,
          displayName,
          identifiers: identifiers
        }
      })
      .sort((a, b) => b.currentValue - a.currentValue) // Sort by current value descending
  }, [positions])

  const totalPortfolioValue = useMemo(() => {
    return activePositions.reduce((sum, pos) => sum + pos.currentValue, 0)
  }, [activePositions])

  // Prepare pie chart data with better colors
  const pieChartData = useMemo(() => {
    const colors = [
      '#8B5CF6', // purple-500
      '#3B82F6', // blue-500
      '#10B981', // emerald-500
      '#F59E0B', // amber-500
      '#EF4444', // red-500
      '#6366F1', // indigo-500
      '#EC4899', // pink-500
      '#06B6D4', // cyan-500
      '#F97316', // orange-500
      '#84CC16'  // lime-500
    ]

    return activePositions.map((position, index) => ({
      name: position.displayName,
      value: position.currentValue,
      weight: position.weight,
      color: colors[index % colors.length],
      symbol: position.symbol,
      index
    }))
  }, [activePositions])

  // Copy to clipboard function
  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedItems(prev => new Set(prev).add(itemId))
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev)
          newSet.delete(itemId)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  if (activePositions.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <PieChart className="h-5 w-5 text-purple-400" />
            <span>Asset Allocation</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            No active positions found (positions must be &gt; €1)
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PieChart className="h-5 w-5 text-purple-400" />
              <span>Asset Allocation</span>
            </div>
            <div className="text-sm text-gray-400">
              {activePositions.length} active positions
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">

            {/* Pie Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              {/* Chart */}
              <div className="h-64 w-full lg:col-span-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="#1F2937"
                      strokeWidth={2}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          className="hover:opacity-80 transition-all duration-200 cursor-pointer"
                          style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          return (
                            <div className="glass-dark rounded-xl p-4 shadow-2xl border border-white/20 backdrop-blur-xl">
                              <div className="flex items-center space-x-3 mb-3">
                                <div
                                  className="w-4 h-4 rounded-full shadow-lg"
                                  style={{ backgroundColor: data.color }}
                                />
                                <h4 className="font-semibold text-white text-sm">
                                  {data.name}
                                </h4>
                              </div>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-300">Weight:</span>
                                  <span className="text-white font-semibold">{formatPercentage(data.weight)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-300">Value:</span>
                                  <span className="text-white font-semibold">
                                    {formatCurrencyPrivate(data.value, showAbsoluteValues)}
                                  </span>
                                </div>
                                {data.symbol && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-300">Symbol:</span>
                                    <span className="text-purple-300 font-medium">{data.symbol}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              {/* Clean Portfolio Breakdown */}
              <div className="space-y-1 lg:col-span-2">
                <h3 className="text-sm font-semibold text-white mb-4">Portfolio Breakdown</h3>
                {pieChartData.map((entry, index) => {
                  const position = activePositions[index]
                  return (
                    <motion.div
                      key={entry.symbol}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center p-3 rounded-lg hover:bg-gray-800/20 transition-colors border border-gray-700/30"
                    >
                      {/* Asset indicator and name */}
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                          style={{ backgroundColor: entry.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white leading-tight">
                            {entry.name}
                          </div>
                          <div className="flex items-center space-x-2 mt-1">
                            {entry.symbol && (
                              <button
                                onClick={() => copyToClipboard(entry.symbol, `symbol-${entry.symbol}`)}
                                className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded hover:bg-purple-500/30 transition-colors cursor-pointer flex items-center space-x-1"
                                title="Click to copy ticker"
                              >
                                <span>{entry.symbol}</span>
                                {copiedItems.has(`symbol-${entry.symbol}`) ? (
                                  <Check className="h-2.5 w-2.5" />
                                ) : (
                                  <Copy className="h-2.5 w-2.5" />
                                )}
                              </button>
                            )}
                            {position.isin && (
                              <button
                                onClick={() => copyToClipboard(position.isin!, `isin-${position.isin}`)}
                                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer flex items-center space-x-1"
                                title="Click to copy ISIN"
                              >
                                <span>{position.isin}</span>
                                {copiedItems.has(`isin-${position.isin}`) ? (
                                  <Check className="h-2.5 w-2.5" />
                                ) : (
                                  <Copy className="h-2.5 w-2.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial metrics - cleaner layout */}
                      <div className="flex items-center space-x-6 text-xs">
                        <div className="text-right min-w-[60px]">
                          <div className="text-gray-500 text-[10px] mb-0.5">Weight</div>
                          <div className="text-white font-semibold">{formatPercentage(entry.weight)}</div>
                        </div>

                        <div className="text-right min-w-[80px]">
                          <div className="text-gray-500 text-[10px] mb-0.5">Invested</div>
                          <div className="text-white font-medium">{formatCurrencyPrivate(position.totalCost, showAbsoluteValues)}</div>
                        </div>

                        <div className="text-right min-w-[80px]">
                          <div className="text-gray-500 text-[10px] mb-0.5">Current</div>
                          <div className="text-white font-medium">{formatCurrencyPrivate(position.currentValue, showAbsoluteValues)}</div>
                        </div>

                        <div className={`text-right min-w-[90px] ${
                          position.unrealizedGain >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          <div className="flex items-center justify-end space-x-1 mb-0.5">
                            {position.unrealizedGain >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span className="text-gray-500 text-[10px]">P/L</span>
                          </div>
                          <div className="font-semibold">
                            {showAbsoluteValues ? (
                              <>
                                {formatCurrencyPrivate(position.unrealizedGain, showAbsoluteValues)}
                                <div className="text-[10px] font-normal">
                                  ({formatPercentage(position.unrealizedGainPercent)})
                                </div>
                              </>
                            ) : (
                              <div className="w-12 h-3 bg-gray-600 rounded animate-pulse" />
                            )}
                          </div>
                        </div>

                        {/* Additional details - more compact */}
                        <div className="text-right text-[10px] text-gray-500 min-w-[100px]">
                          <div className="mb-0.5">{position.shares.toLocaleString()} shares</div>
                          <div className="mb-0.5">Avg: {formatCurrencyPrivate(position.averagePrice, showAbsoluteValues)}</div>
                          <div className={position.currentPrice >= position.averagePrice ? 'text-green-400' : 'text-red-400'}>
                            {formatPercentage(((position.currentPrice - position.averagePrice) / position.averagePrice) * 100)}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>


            {/* Clean Summary statistics */}
            <div className="mt-6 grid grid-cols-3 gap-6 pt-4 border-t border-gray-700/30">
              <div className="text-center">
                <div className="text-base font-semibold text-white">
                  {formatCurrencyPrivate(
                    activePositions.reduce((sum, pos) => sum + pos.totalCost, 0),
                    showAbsoluteValues
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">Total Invested</div>
              </div>

              <div className="text-center">
                <div className="text-base font-semibold text-white">
                  {formatCurrencyPrivate(
                    activePositions.reduce((sum, pos) => sum + pos.currentValue, 0),
                    showAbsoluteValues
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">Current Value</div>
              </div>

              <div className="text-center">
                <div className={`text-base font-semibold ${
                  activePositions.reduce((sum, pos) => sum + pos.unrealizedGain, 0) >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {formatCurrencyPrivate(
                    activePositions.reduce((sum, pos) => sum + pos.unrealizedGain, 0),
                    showAbsoluteValues
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">Total P/L</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Tooltip */}
      {hoveredPosition && (
        <AllocationTooltip
          position={hoveredPosition.position}
          index={hoveredPosition.index}
          isVisible={true}
          x={hoveredPosition.x}
          y={hoveredPosition.y}
        />
      )}
    </motion.div>
  )
}
