'use client'

import { motion } from "framer-motion";
import {
	DollarSign, PieChart, ToggleLeft, ToggleRight, TrendingDown, TrendingUp, Wallet
} from "lucide-react";
import React from "react";

import { formatCurrencyPrivate, usePrivacy } from "@/context/PrivacyContext";
import { formatPercent } from "@/lib/utils";
import { PortfolioSummary } from "@/types/portfolio";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface PortfolioSummaryProps {
  summary: PortfolioSummary
  includeTax?: boolean
  onTaxToggle?: (includeTax: boolean) => void
}

export const PortfolioSummaryComponent: React.FC<PortfolioSummaryProps> = ({
  summary,
  includeTax = true,
  onTaxToggle
}) => {
  const { showAbsoluteValues } = usePrivacy()

  // Calculate gross return before taxes (add taxes back to the net return)
  // summary.totalReturn is already after-tax (net), so to get gross, we add taxes back
  const grossReturn = summary.totalReturn + summary.totalTaxes
  const grossReturnPercentage = summary.totalInvested > 0
    ? (grossReturn / summary.totalInvested) * 100
    : 0

  // includeTax=true means show net (after-tax), includeTax=false means show gross (before-tax)
  const displayReturn = includeTax ? summary.totalReturn : grossReturn
  const displayReturnPercentage = includeTax ? summary.totalReturnPercentage : grossReturnPercentage

  const cards = [
    {
      title: "Total Value",
      value: formatCurrencyPrivate(summary.totalValue, showAbsoluteValues),
      icon: Wallet,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20"
    },
    {
      title: "Total Return",
      value: formatCurrencyPrivate(displayReturn, showAbsoluteValues),
      subtitle: formatPercent(displayReturnPercentage),
      icon: displayReturn >= 0 ? TrendingUp : TrendingDown,
      color: displayReturn >= 0 ? "text-green-400" : "text-red-400",
      bgColor: displayReturn >= 0 ? "bg-green-500/20" : "bg-red-500/20",
      showToggle: true
    },
    {
      title: "Cash Balance",
      value: formatCurrencyPrivate(summary.totalCash, showAbsoluteValues),
      icon: DollarSign,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20"
    },
    {
      title: "Total Invested",
      value: formatCurrencyPrivate(summary.totalInvested, showAbsoluteValues),
      icon: PieChart,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20"
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
        >
           <Card className="relative overflow-hidden group hover:glow transition-all duration-300 h-40 flex flex-col">
             <CardHeader className="flex flex-row items-center justify-between pb-3 flex-shrink-0">
               <div className="flex items-center space-x-2">
                 <CardTitle className="text-sm font-medium text-gray-400">
                   {card.title}
                 </CardTitle>
                 {card.showToggle && onTaxToggle && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={() => onTaxToggle(!includeTax)}
                     className="flex items-center space-x-1 text-gray-400 hover:text-white h-6 px-2"
                     title={includeTax ? "Click to show before-tax return" : "Click to show after-tax return"}
                   >
                     {includeTax ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                     <span className="text-xs">
                       {includeTax ? 'incl. tax' : 'excl. tax'}
                     </span>
                   </Button>
                 )}
               </div>
               <div className={`p-2 rounded-lg ${card.bgColor}`}>
                 <card.icon className={`h-4 w-4 ${card.color}`} />
               </div>
             </CardHeader>

             <CardContent className="flex-grow flex flex-col justify-center">
               <div className="space-y-1">
                 <p className="text-2xl font-bold text-white">
                   {card.value}
                 </p>
                 {card.subtitle && (
                   <p className={`text-sm font-medium ${card.color}`}>
                     {card.subtitle}
                   </p>
                 )}
               </div>
             </CardContent>

             {/* Animated background effect */}
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-all duration-1000" />
           </Card>
        </motion.div>
      ))}

      {/* Additional metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="col-span-full"
      >
        <Card>
          <CardHeader>
            <CardTitle>Additional Metrics</CardTitle>
          </CardHeader>
           <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <div className="text-center p-4 glass rounded-lg h-20 flex flex-col justify-center">
                 <p className="text-sm text-gray-400 mb-1">Total Dividends</p>
                 <p className="text-lg font-semibold text-green-400">
                   {formatCurrencyPrivate(summary.totalDividends, showAbsoluteValues)}
                 </p>
               </div>

               <div className="text-center p-4 glass rounded-lg h-20 flex flex-col justify-center">
                 <p className="text-sm text-gray-400 mb-1">Total Interest</p>
                 <p className="text-lg font-semibold text-green-400">
                   {formatCurrencyPrivate(summary.totalInterest, showAbsoluteValues)}
                 </p>
               </div>

               <div className="text-center p-4 glass rounded-lg h-20 flex flex-col justify-center">
                 <p className="text-sm text-gray-400 mb-1">Total Fees</p>
                 <p className="text-lg font-semibold text-red-400">
                   {formatCurrencyPrivate(summary.totalFees, showAbsoluteValues)}
                 </p>
               </div>

               <div className="text-center p-4 glass rounded-lg h-20 flex flex-col justify-center">
                 <p className="text-sm text-gray-400 mb-1">Total Taxes</p>
                 <p className="text-lg font-semibold text-red-400">
                   {formatCurrencyPrivate(summary.totalTaxes, showAbsoluteValues)}
                 </p>
               </div>
             </div>
           </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
