'use client'

import { motion } from "framer-motion";
import { Check, FileText, Layers, Plus } from "lucide-react";
import React from "react";

import { formatCurrencyPrivate, usePrivacy } from "@/context/PrivacyContext";
import { Portfolio } from "@/types/portfolio";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface PortfolioSelectorProps {
  portfolios: Portfolio[]
  selectedPortfolioIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
  onAddPortfolio?: () => void
}

export const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  portfolios,
  selectedPortfolioIds,
  onSelectionChange,
  onAddPortfolio
}) => {
  const { showAbsoluteValues } = usePrivacy()
  const handlePortfolioToggle = (portfolioId: string) => {
    const isSelected = selectedPortfolioIds.includes(portfolioId)

    if (isSelected) {
      // Remove from selection
      onSelectionChange(selectedPortfolioIds.filter(id => id !== portfolioId))
    } else {
      // Add to selection
      onSelectionChange([...selectedPortfolioIds, portfolioId])
    }
  }

  const handleSelectAll = () => {
    if (selectedPortfolioIds.length === portfolios.length) {
      // Deselect all
      onSelectionChange([])
    } else {
      // Select all
      onSelectionChange(portfolios.map(p => p.id))
    }
  }

  const allSelected = selectedPortfolioIds.length === portfolios.length
  const someSelected = selectedPortfolioIds.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="h-5 w-5 text-purple-400" />
              <CardTitle>Portfolio Selection</CardTitle>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="text-gray-400 hover:text-white"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
              {onAddPortfolio && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAddPortfolio}
                  className="text-gray-400 hover:text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Portfolio
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {portfolios.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No portfolios loaded</p>
              </div>
            ) : (
              portfolios.map((portfolio, index) => {
                const isSelected = selectedPortfolioIds.includes(portfolio.id)

                return (
                  <motion.div
                    key={portfolio.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <div
                      className={`
                        p-4 rounded-lg border-2 transition-all duration-200 cursor-pointer
                        ${isSelected
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }
                      `}
                      onClick={() => handlePortfolioToggle(portfolio.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`
                            p-2 rounded-lg transition-colors
                            ${isSelected ? 'bg-purple-500' : 'bg-gray-700'}
                          `}>
                            {isSelected ? (
                              <Check className="h-4 w-4 text-white" />
                            ) : (
                              <FileText className="h-4 w-4 text-gray-400" />
                            )}
                          </div>

                          <div>
                            <h3 className="font-medium text-white">{portfolio.name}</h3>
                            {portfolio.fileName && (
                              <p className="text-sm text-gray-400">{portfolio.fileName}</p>
                            )}
                          </div>
                        </div>

                        {portfolio.summary && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">
                              {formatCurrencyPrivate(portfolio.summary.totalValue, showAbsoluteValues)}
                            </p>
                            <p className={`text-xs ${
                              portfolio.summary.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {showAbsoluteValues && portfolio.summary.totalReturn >= 0 ? '+' : ''}
                              {formatCurrencyPrivate(portfolio.summary.totalReturn, showAbsoluteValues)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>

          {someSelected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg"
            >
              <p className="text-sm text-purple-300">
                {selectedPortfolioIds.length === 1
                  ? `1 portfolio selected`
                  : `${selectedPortfolioIds.length} portfolios selected ${selectedPortfolioIds.length > 1 ? '(aggregated view)' : ''}`
                }
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
