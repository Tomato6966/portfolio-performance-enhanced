'use client'

import { motion } from "framer-motion";
import { ToggleLeft, ToggleRight, TrendingDown, TrendingUp } from "lucide-react";
import React, { useState } from "react";
import {
	Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

import { formatCurrencyPrivate, usePrivacy } from "@/context/PrivacyContext";
import { formatPercent } from "@/lib/utils";
import { PerformanceData } from "@/types/portfolio";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

// Helper function to format Y-axis values with abbreviated notation
const formatYAxisValue = (value: number, showAbsoluteValues: boolean): string => {
  if (!showAbsoluteValues) {
    return "••• €"
  }

  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M €`
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k €`
  } else {
    return `${value.toFixed(0)} €`
  }
}
interface PerformanceChartProps {
  data: PerformanceData[]
  title?: string
  showInvested?: boolean
  includeTax?: boolean
  onTaxToggle?: (includeTax: boolean) => void
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  title = "Portfolio Performance",
  showInvested = true,
  includeTax = true,
  onTaxToggle
}) => {
  const { showAbsoluteValues } = usePrivacy()
  const [showPLPercent, setShowPLPercent] = useState(true) // Default to P/L %

  if (!data || data.length === 0) {
    return (
      <Card className="h-96">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-400">No data available</p>
        </CardContent>
      </Card>
    )
  }

  const latestData = data[data.length - 1]
  const firstData = data[0]

  // Calculate performance relative to the selected time period
  const periodReturn = latestData.return - firstData.return
  const periodReturnPercent = firstData.invested > 0
    ? (periodReturn / firstData.invested) * 100
    : 0

  // Total return for wealth % calculation (value change from start to end of period)
  const totalReturn = latestData.portfolioValue - firstData.portfolioValue
  const totalReturnPercent = firstData.portfolioValue > 0
    ? ((latestData.portfolioValue - firstData.portfolioValue) / firstData.portfolioValue) * 100
    : 0

  // Calculate gross return by adding taxes back to the net return for the period
  const grossPeriodReturn = periodReturn + (latestData.taxes - firstData.taxes)
  const grossPeriodReturnPercentage = firstData.invested > 0
    ? (grossPeriodReturn / firstData.invested) * 100
    : 0

  // includeTax=true means show net (after-tax), includeTax=false means show gross (before-tax)
  const displayReturn = includeTax ? periodReturn : grossPeriodReturn
  const displayReturnPercentage = includeTax ? periodReturnPercent : grossPeriodReturnPercentage

  // Calculate P/L percentage for the period (based on invested amount at end of period)
  const totalPLPercent = latestData.invested > 0 ? (displayReturn / latestData.invested) * 100 : 0

  console.log(`📊 [Performance Chart] Period performance calculation:`, {
    dateRange: `${firstData.date.toISOString().split('T')[0]} to ${latestData.date.toISOString().split('T')[0]}`,
    firstData: { return: firstData.return, invested: firstData.invested, taxes: firstData.taxes },
    latestData: { return: latestData.return, invested: latestData.invested, taxes: latestData.taxes },
    periodReturn,
    grossPeriodReturn,
    displayReturn,
    displayReturnPercentage: `${displayReturnPercentage.toFixed(2)}%`,
    totalPLPercent: `${totalPLPercent.toFixed(2)}%`,
    calculationMethod: `P/L % = ${displayReturn.toFixed(2)} / ${latestData.invested.toFixed(2)} * 100`,
    includeTax
  })

  const chartData = data.map(item => {
    // Calculate returns relative to the start of the selected period
    const relativeReturn = item.return - firstData.return
    const relativeTaxes = item.taxes - firstData.taxes
    const relativeGrossReturn = relativeReturn + relativeTaxes

    const displayItemReturn = includeTax ? relativeReturn : relativeGrossReturn
    const displayItemReturnPercentage = firstData.invested > 0 ? (displayItemReturn / firstData.invested) * 100 : 0

    // P/L percentage should be based on the invested amount up to THIS date, not the start date
    const plPercentage = item.invested > 0 ? (displayItemReturn / item.invested) * 100 : 0

    return {
      date: item.date.toISOString().split('T')[0],
      portfolioValue: item.portfolioValue,
      invested: item.invested,
      cash: item.cash,
      return: displayItemReturn,
      returnPercentage: displayItemReturnPercentage,
      // P/L percentage based on cumulative invested amount up to this date
      plPercentage: plPercentage
    }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="glass-dark rounded-lg p-3 border border-white/20">
          <p className="text-white font-medium">{new Date(label).toLocaleDateString('de-DE')}</p>
          <div className="space-y-1 mt-2">
            <p className="text-purple-400">
              Portfolio: {formatCurrencyPrivate(data.portfolioValue, showAbsoluteValues)}
            </p>
            {showInvested && (
              <p className="text-blue-400">
                Invested: {formatCurrencyPrivate(data.invested, showAbsoluteValues)}
              </p>
            )}
            <p className="text-gray-400">
              Cash: {formatCurrencyPrivate(data.cash, showAbsoluteValues)}
            </p>
            <p className={`${data.return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              Period Return: {formatCurrencyPrivate(data.return, showAbsoluteValues)} ({formatPercent(showPLPercent ? data.plPercentage : data.returnPercentage)})
            </p>
            <p className="text-gray-300 text-xs">
              {showPLPercent ? 'P/L %' : 'Wealth %'}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card className="glow">
         <CardHeader>
           <div className="flex items-center justify-between">
             <CardTitle className="text-xl">{title}</CardTitle>
              <div className="flex items-center space-x-4">
                {/* Toggle for P/L % vs Wealth % */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPLPercent(!showPLPercent)}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white"
                >
                  {showPLPercent ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  <span className="text-xs">
                    {showPLPercent ? 'P/L %' : 'Wealth %'}
                  </span>
                </Button>

                {/* Toggle for Tax inclusion */}
                {onTaxToggle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTaxToggle(!includeTax)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white"
                  >
                    {includeTax ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    <span className="text-xs">
                      {includeTax ? 'incl. tax' : 'excl. tax'}
                    </span>
                  </Button>
                )}

               <div className="text-right min-w-[240px]">
                 <p className="text-2xl font-bold text-white">
                   {formatCurrencyPrivate(latestData.portfolioValue, showAbsoluteValues)}
                 </p>
                <div className={`flex items-center justify-end space-x-1 ${(showPLPercent ? displayReturn : totalReturn) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(showPLPercent ? displayReturn : totalReturn) >= 0 ? (
                    <TrendingUp className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <TrendingDown className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="font-medium">
                    {formatCurrencyPrivate(showPLPercent ? displayReturn : totalReturn, showAbsoluteValues)} ({formatPercent(showPLPercent ? totalPLPercent : totalReturnPercent)})
                  </span>
                </div>
                 <p className="text-xs text-gray-400 whitespace-nowrap">
                   {showPLPercent ? 'P/L % (vs invested)' : 'Wealth % (vs start value)'}
                 </p>
               </div>
             </div>
           </div>
         </CardHeader>

        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="investedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.6)"
                  fontSize={12}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('de-DE', {
                    month: 'short',
                    day: 'numeric'
                  })}
                />

                <YAxis
                  stroke="rgba(255,255,255,0.6)"
                  fontSize={12}
                  width={80}
                  tickFormatter={(value) => formatYAxisValue(value, showAbsoluteValues)}
                />

                <Tooltip content={<CustomTooltip />} />

                {showInvested && (
                  <Area
                    type="monotone"
                    dataKey="invested"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#investedGradient)"
                    strokeDasharray="5 5"
                  />
                )}

                <Area
                  type="monotone"
                  dataKey="portfolioValue"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fill="url(#portfolioGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
