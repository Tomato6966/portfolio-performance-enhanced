'use client'

import { motion } from "framer-motion";
import { Calendar, TrendingDown, TrendingUp } from "lucide-react";
import React, { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyPrivate, usePrivacy } from "@/context/PrivacyContext";
import { PerformanceData } from "@/types/portfolio";

interface MonthlyFlowMatrixProps {
  performanceData: PerformanceData[]
  className?: string
}

interface MonthlyFlow {
  year: number
  month: number
  netFlow: number
  contributions: number
  withdrawals: number
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

export const MonthlyFlowMatrix: React.FC<MonthlyFlowMatrixProps> = ({
  performanceData,
  className = ""
}) => {
  const { showAbsoluteValues } = usePrivacy()

  // Calculate monthly cash flows
  const monthlyFlows = useMemo((): MonthlyFlow[] => {
    if (!performanceData || performanceData.length === 0) return []

    const sortedData = [...performanceData].sort((a, b) => a.date.getTime() - b.date.getTime())
    const flows: MonthlyFlow[] = []

    // Group by year-month and calculate net flows
    const monthlyData = new Map<string, {
      year: number
      month: number
      startInvested: number
      endInvested: number
      startCash: number
      endCash: number
    }>()

    sortedData.forEach((data, index) => {
      const year = data.date.getFullYear()
      const month = data.date.getMonth()
      const key = `${year}-${month}`

      if (!monthlyData.has(key)) {
        monthlyData.set(key, {
          year,
          month,
          startInvested: data.invested,
          endInvested: data.invested,
          startCash: data.cash,
          endCash: data.cash
        })
      } else {
        const existing = monthlyData.get(key)!
        existing.endInvested = data.invested
        existing.endCash = data.cash
      }
    })

    // Calculate flows for each month
    monthlyData.forEach(({ year, month, startInvested, endInvested, startCash, endCash }) => {
      // Net change in invested amount indicates contributions/withdrawals
      const investedChange = endInvested - startInvested
      const cashChange = endCash - startCash

      // Total net flow (positive = contributions, negative = withdrawals)
      const netFlow = investedChange + cashChange

      flows.push({
        year,
        month,
        netFlow,
        contributions: netFlow > 0 ? netFlow : 0,
        withdrawals: netFlow < 0 ? Math.abs(netFlow) : 0
      })
    })

    return flows.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
  }, [performanceData])

  // Create matrix data structure
  const matrixData = useMemo(() => {
    if (monthlyFlows.length === 0) return { years: [], matrix: new Map() }

    const years = [...new Set(monthlyFlows.map(f => f.year))].sort()
    const matrix = new Map<string, MonthlyFlow>()

    monthlyFlows.forEach(flow => {
      matrix.set(`${flow.year}-${flow.month}`, flow)
    })

    return { years, matrix }
  }, [monthlyFlows])

  // Calculate color intensity for heat map
  const getFlowIntensity = (netFlow: number): string => {
    if (netFlow === 0) return 'bg-gray-800'

    const maxFlow = Math.max(
      ...monthlyFlows.map(f => Math.abs(f.netFlow))
    )

    if (maxFlow === 0) return 'bg-gray-800'

    const intensity = Math.abs(netFlow) / maxFlow

    if (netFlow > 0) {
      // Contributions - green
      if (intensity > 0.8) return 'bg-green-600'
      if (intensity > 0.6) return 'bg-green-500'
      if (intensity > 0.4) return 'bg-green-400'
      if (intensity > 0.2) return 'bg-green-300'
      return 'bg-green-200'
    } else {
      // Withdrawals - red
      if (intensity > 0.8) return 'bg-red-600'
      if (intensity > 0.6) return 'bg-red-500'
      if (intensity > 0.4) return 'bg-red-400'
      if (intensity > 0.2) return 'bg-red-300'
      return 'bg-red-200'
    }
  }

  const getTextColor = (netFlow: number): string => {
    if (netFlow === 0) return 'text-gray-400'

    const maxFlow = Math.max(
      ...monthlyFlows.map(f => Math.abs(f.netFlow))
    )

    const intensity = Math.abs(netFlow) / maxFlow

    if (intensity > 0.4) {
      return 'text-white'
    } else {
      return netFlow > 0 ? 'text-green-900' : 'text-red-900'
    }
  }

  if (monthlyFlows.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            <span>Monthly Cash Flows</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            No cash flow data available
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
              <Calendar className="h-5 w-5 text-purple-400" />
              <span>Monthly Cash Flows</span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-400">
              <div className="flex items-center space-x-1">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <span>Contributions</span>
              </div>
              <div className="flex items-center space-x-1">
                <TrendingDown className="h-3 w-3 text-red-400" />
                <span>Withdrawals</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              {/* Header row with months */}
              <thead>
                <tr>
                  <th className="text-left text-sm font-medium text-gray-400 py-3 px-2 border-b border-gray-700">Year</th>
                  {MONTHS.map(month => (
                    <th key={month} className="text-center text-sm font-medium text-gray-400 py-3 px-2 border-b border-gray-700 min-w-[80px]">
                      {month}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Data rows */}
              <tbody>
                {matrixData.years.map(year => (
                  <motion.tr
                    key={year}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: (year - matrixData.years[0]) * 0.1 }}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Year label */}
                    <td className="text-center text-sm font-medium text-white py-3 px-2 border-b border-gray-800">
                      {year}
                    </td>

                    {/* Monthly cells */}
                    {MONTHS.map((month, monthIndex) => {
                      const flow = matrixData.matrix.get(`${year}-${monthIndex}`)
                      const netFlow = flow?.netFlow || 0

                      return (
                        <motion.td
                          key={`${year}-${monthIndex}`}
                          className={`
                            text-center py-3 px-2 border-b border-gray-800 min-w-[80px]
                            ${getFlowIntensity(netFlow)}
                            ${netFlow !== 0 ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
                          `}
                          whileHover={netFlow !== 0 ? { scale: 1.05 } : {}}
                          title={
                            flow ?
                            `${month} ${year}\nNet Flow: ${showAbsoluteValues ? formatCurrencyPrivate(netFlow, true) : '[Hidden]'}\nContributions: ${showAbsoluteValues ? formatCurrencyPrivate(flow.contributions, true) : '[Hidden]'}\nWithdrawals: ${showAbsoluteValues ? formatCurrencyPrivate(flow.withdrawals, true) : '[Hidden]'}` :
                            `${month} ${year}\nNo activity`
                          }
                        >
                          {flow && netFlow !== 0 && (
                            <div className={`text-sm font-medium ${getTextColor(netFlow)}`}>
                              {showAbsoluteValues ? (
                                netFlow > 0 ? `+${(netFlow / 1000).toFixed(1)}k` : `${(netFlow / 1000).toFixed(1)}k`
                              ) : (
                                <div className="w-8 h-3 bg-gray-300 rounded opacity-70 mx-auto" />
                              )}
                            </div>
                          )}

                          {(!flow || netFlow === 0) && (
                            <div className="text-sm text-gray-600">—</div>
                          )}
                        </motion.td>
                      )
                    })}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center justify-center space-x-6 text-xs text-gray-400">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>High Contributions</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-green-300 rounded"></div>
              <span>Low Contributions</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-800 rounded"></div>
              <span>No Activity</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-300 rounded"></div>
              <span>Low Withdrawals</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>High Withdrawals</span>
            </div>
          </div>

          {/* Summary Stats */}
          {showAbsoluteValues && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 glass rounded-lg">
                <div className="text-lg font-bold text-green-400">
                  {formatCurrencyPrivate(monthlyFlows.reduce((sum, f) => sum + f.contributions, 0), showAbsoluteValues)}
                </div>
                <div className="text-sm text-gray-400">Total Contributions</div>
              </div>
              <div className="text-center p-4 glass rounded-lg">
                <div className="text-lg font-bold text-red-400">
                  {formatCurrencyPrivate(monthlyFlows.reduce((sum, f) => sum + f.withdrawals, 0), showAbsoluteValues)}
                </div>
                <div className="text-sm text-gray-400">Total Withdrawals</div>
              </div>
              <div className="text-center p-4 glass rounded-lg">
                <div className="text-lg font-bold text-white">
                  {formatCurrencyPrivate(monthlyFlows.reduce((sum, f) => sum + f.netFlow, 0), showAbsoluteValues)}
                </div>
                <div className="text-sm text-gray-400">Net Cash Flow</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
