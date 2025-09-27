'use client'

import { formatDate } from "date-fns";
import { motion } from "framer-motion";
import { CheckSquare, Eye, EyeOff, Square } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyPrivate, usePrivacy } from "@/context/PrivacyContext";
import { ProcessedTransaction } from "@/types/portfolio";

interface TransactionGroup {
  id: string
  name: string
  asset?: {
    isin?: string
    symbol?: string
    name?: string
  }
  transactions: ProcessedTransaction[]
  totalValue: number
  enabled: boolean
}

interface TransactionHistoryProps {
  transactions: ProcessedTransaction[]
  onTransactionSelectionChange: (selectedTransactionIds: string[]) => void
  className?: string
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  transactions,
  onTransactionSelectionChange,
  className = ""
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [groupsEnabled, setGroupsEnabled] = useState<Map<string, boolean>>(new Map())
  const { showAbsoluteValues } = usePrivacy()
  const initializedRef = useRef<Set<string>>(new Set())

  // Group transactions by asset
  const transactionGroups = useMemo((): TransactionGroup[] => {
    const groups = new Map<string, TransactionGroup>()

    transactions.forEach(transaction => {
      let groupKey = 'cash-transactions'
      let groupName = '💰 Cash Transactions'
      let asset = undefined

      if (transaction.asset) {
        groupKey = transaction.asset.isin || transaction.asset.symbol || transaction.asset.name || 'unknown-asset'
        groupName = transaction.asset.name || transaction.asset.symbol || transaction.asset.isin || 'Unknown Asset'
        asset = transaction.asset
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          name: groupName,
          asset,
          transactions: [],
          totalValue: 0,
          enabled: true // Default to enabled
        })
      }

      const group = groups.get(groupKey)!
      group.transactions.push(transaction)
      group.totalValue += Math.abs(transaction.amount)
    })

    // Sort groups by total value (descending)
    return Array.from(groups.values()).sort((a, b) => b.totalValue - a.totalValue)
  }, [transactions])

  // Initialize all groups as enabled on first render (only for new groups)
  React.useEffect(() => {
    const newGroupsToEnable = new Map<string, boolean>()
    let hasNewGroups = false

    transactionGroups.forEach(group => {
      if (!initializedRef.current.has(group.id)) {
        newGroupsToEnable.set(group.id, true)
        initializedRef.current.add(group.id)
        hasNewGroups = true
      }
    })

    if (hasNewGroups) {
      setGroupsEnabled(prev => {
        const updated = new Map(prev)
        newGroupsToEnable.forEach((enabled, groupId) => {
          updated.set(groupId, enabled)
        })
        return updated
      })
    }
  }, [transactionGroups])

  // Memoize the selection calculation to avoid unnecessary calls
  const selectedTransactionIds = useMemo(() => {
    const ids: string[] = []
    transactionGroups.forEach(group => {
      if (groupsEnabled.get(group.id)) {
        group.transactions.forEach(t => ids.push(t.id))
      }
    })
    return ids
  }, [groupsEnabled, transactionGroups])

  // Update parent when selection changes (only when the actual selection changes)
  React.useEffect(() => {
    onTransactionSelectionChange(selectedTransactionIds)
  }, [selectedTransactionIds, onTransactionSelectionChange])

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(groupId)) {
        newSet.delete(groupId)
      } else {
        newSet.add(groupId)
      }
      return newSet
    })
  }

  const toggleGroupEnabled = (groupId: string) => {
    setGroupsEnabled(prev => {
      const newMap = new Map(prev)
      newMap.set(groupId, !newMap.get(groupId))
      return newMap
    })
  }

  const selectAll = () => {
    setGroupsEnabled(prev => {
      const newMap = new Map(prev)
      transactionGroups.forEach(group => {
        newMap.set(group.id, true)
      })
      return newMap
    })
  }

  const selectNone = () => {
    setGroupsEnabled(prev => {
      const newMap = new Map(prev)
      transactionGroups.forEach(group => {
        newMap.set(group.id, false)
      })
      return newMap
    })
  }

  const enabledCount = Array.from(groupsEnabled.values()).filter(Boolean).length
  const totalGroups = transactionGroups.length

  // Format currency with privacy option
  const formatCurrencyPrivateLocal = (amount: number): React.ReactNode => {
    return formatCurrencyPrivate(amount, showAbsoluteValues)
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'buy': return 'text-green-400'
      case 'sell': return 'text-red-400'
      case 'dividend': return 'text-blue-400'
      case 'interest': return 'text-purple-400'
      case 'deposit': return 'text-green-300'
      case 'withdrawal': return 'text-red-300'
      case 'fee': return 'text-orange-400'
      case 'tax': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <motion.div
      className={`space-y-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transaction History ({transactions.length} transactions)</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">
                {enabledCount} of {totalGroups} groups selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="h-8 px-3"
              >
                <CheckSquare className="h-3 w-3 mr-1" />
                All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={selectNone}
                className="h-8 px-3"
              >
                <Square className="h-3 w-3 mr-1" />
                None
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactionGroups.map(group => {
            const isExpanded = expandedGroups.has(group.id)
            const isEnabled = groupsEnabled.get(group.id) ?? true

            return (
              <motion.div
                key={group.id}
                className={`border rounded-lg transition-all duration-200 ${
                  isEnabled ? 'border-purple-500/30 bg-purple-500/5' : 'border-gray-700 bg-gray-800/30'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {/* Group Header */}
                <div
                  className="p-4 cursor-pointer select-none flex items-center justify-between hover:bg-purple-500/10 transition-colors"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleGroupEnabled(group.id)
                      }}
                      className="h-6 w-6 p-0"
                    >
                      {isEnabled ? (
                        <Eye className="h-4 w-4 text-green-400" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>

                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className={`font-medium ${isEnabled ? 'text-white' : 'text-gray-400'}`}>
                          {group.name}
                        </h3>
                        {group.asset?.symbol && (
                          <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                            {group.asset.symbol}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 flex items-center space-x-2">
                        <span>{group.transactions.length} transactions</span>
                        <span>•</span>
                        <span>{formatCurrencyPrivateLocal(group.totalValue)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </div>
                </div>

                {/* Expanded Transaction Details */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="border-t border-gray-700"
                  >
                    <div className="p-4 space-y-2">
                      {group.transactions
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .map(transaction => (
                        <div
                          key={transaction.id}
                          className={`flex items-center justify-between p-3 rounded border transition-all ${
                            isEnabled
                              ? 'border-gray-600 bg-gray-800/50'
                              : 'border-gray-700 bg-gray-800/20 opacity-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className={`text-xs font-medium uppercase tracking-wide ${getTransactionTypeColor(transaction.type)}`}>
                              {transaction.type}
                            </span>
                            <span className="text-sm text-gray-300">
                              {formatDate(transaction.date, 'dd.MM.yyyy')}
                            </span>
                            {transaction.shares && transaction.shares > 0 && (
                              <span className="text-xs text-gray-400">
                                {transaction.shares} shares
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className={`font-medium flex items-center justify-end ${transaction.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {formatCurrencyPrivateLocal(transaction.amount)}
                            </div>
                            {transaction.fees > 0 && (
                              <div className="text-xs text-orange-400 flex items-center justify-end space-x-1">
                                <span>Fee:</span>
                                <span>{formatCurrencyPrivateLocal(transaction.fees)}</span>
                              </div>
                            )}
                            {transaction.taxes > 0 && (
                              <div className="text-xs text-yellow-400 flex items-center justify-end space-x-1">
                                <span>Tax:</span>
                                <span>{formatCurrencyPrivateLocal(transaction.taxes)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </CardContent>
      </Card>
    </motion.div>
  )
}
