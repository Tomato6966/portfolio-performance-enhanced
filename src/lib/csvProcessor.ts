import { parse } from "date-fns";
import Papa from "papaparse";

import { ProcessedTransaction } from "../types/portfolio";

const parseGermanDate = (dateStr: string): Date => {
  // Handle formats like "2024-10-07T11:14" or "2024-11-11T21:45"
  if (dateStr.includes('T')) {
    return new Date(dateStr)
  }

  // Handle German date formats like "07.10.2024"
  if (dateStr.includes('.')) {
    const [day, month, year] = dateStr.split('.')
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Fallback to ISO date
  return new Date(dateStr)
}

const parseGermanNumber = (numberStr: string): number => {
  if (!numberStr || numberStr === '') return 0

  // Remove currency symbols and spaces
  let cleaned = numberStr.replace(/[€$£¥\s]/g, '')

  // Handle German number format (1.234,56 -> 1234.56)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Format like 1.234,56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',')) {
    // Format like 1234,56
    cleaned = cleaned.replace(',', '.')
  }

  return parseFloat(cleaned) || 0
}

const mapTransactionType = (germanType: string): ProcessedTransaction['type'] => {
  if (!germanType) return 'buy'

  const type = germanType.toLowerCase().trim()

  // Check for interest first (exact match)
  if (type === 'zinsen' || type === 'interest' || type.includes('zins')) {
    return 'interest'
  }

  // Check for delivery transactions (cash-free transfers)
  if (type.includes('einlieferung')) {
    console.log(`📥 EINLIEFERUNG: ${germanType}`)
    return 'buy' // Treat as buy, but will generate automatic cash deposit
  }
  if (type.includes('auslieferung')) {
    console.log(`📤 AUSLIEFERUNG: ${germanType}`)
    return 'sell' // Treat as sell, but will generate automatic cash withdrawal
  }

  // Then check other types
  if (type.includes('kauf') || type.includes('buy')) return 'buy'
  if (type.includes('verkauf') || type.includes('sell')) return 'sell'
  if (type.includes('dividende') || type.includes('dividend')) return 'dividend'
  if (type.includes('einlage') || type.includes('deposit')) return 'deposit'
  if (type.includes('entnahme') || type.includes('withdrawal')) return 'withdrawal'
  if (type.includes('gebühr') || type.includes('fee')) return 'fee'
  if (type.includes('steuer') || type.includes('tax')) return 'tax'

  return 'buy'
}

// Helper function to check if a transaction is a delivery (cash-free transfer)
const isDeliveryTransaction = (germanType: string): boolean => {
  const type = germanType.toLowerCase().trim()
  return type.includes('einlieferung') || type.includes('auslieferung')
}

// Helper function to create automatic cash adjustment for delivery transactions
const createCashAdjustment = (baseTransaction: ProcessedTransaction, originalType: string): ProcessedTransaction => {
  const type = originalType.toLowerCase().trim()
  const isEinlieferung = type.includes('einlieferung')

  // For EINLIEFERUNG: We receive shares, so we need to add equivalent cash to balance
  // For AUSLIEFERUNG: We give away shares, so we need to remove equivalent cash to balance
  // The cash adjustment should counteract the buy/sell transaction's effect on cash

  let adjustmentAmount: number

  if (isEinlieferung) {
    // EINLIEFERUNG is treated as 'buy' which reduces cash by transaction amount
    // So we add a deposit of the same amount to neutralize the cash effect
    adjustmentAmount = Math.abs(baseTransaction.amount) + baseTransaction.fees + baseTransaction.taxes
  } else {
    // AUSLIEFERUNG is treated as 'sell' which increases cash by transaction amount
    // So we add a withdrawal of the same amount to neutralize the cash effect
    adjustmentAmount = Math.abs(baseTransaction.amount) - baseTransaction.fees - baseTransaction.taxes
  }

  return {
    id: `${baseTransaction.id}-cash-adjustment`,
    date: baseTransaction.date,
    type: isEinlieferung ? 'deposit' : 'withdrawal',
    amount: Math.abs(adjustmentAmount), // Always positive amount
    currency: baseTransaction.currency,
    fees: 0,
    taxes: 0,
    notes: `Auto-generated cash adjustment for ${originalType}: ${baseTransaction.asset?.name || 'Unknown asset'} (neutralizes cash effect)`
  }
}

export const parsePortfolioCSV = async (file: File): Promise<ProcessedTransaction[]> => {
  return new Promise((resolve, reject) => {
    console.log(`🔍 [CSV Parser] Starting to parse portfolio CSV: ${file.name}`)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          console.log(`📊 [CSV Parser] Raw CSV data:`, result.data.slice(0, 3)) // Log first 3 rows
          console.log(`📋 [CSV Parser] Headers detected:`, result.meta.fields)

          const transactions: ProcessedTransaction[] = []
          const cashAdjustments: ProcessedTransaction[] = []

          result.data.forEach((row: any, index: number) => {
            try {
              // Extract the transaction type first
              const originalType = row.Typ || row.typ || ''
              const mappedType = mapTransactionType(originalType)

              // Check if this is a delivery transaction (cash-free transfer)
              const isDelivery = isDeliveryTransaction(originalType)

              // Handle Portfolio Performance CSV format
              const transaction: ProcessedTransaction = {
                id: `transaction-${index}`,
                date: parseGermanDate(row.Datum || row.datum || ''),
                type: mappedType,
                amount: parseGermanNumber(row.Wert || row.wert || '0'),
                currency: row.Buchungswahrung || row.buchungswahrung || 'EUR',
                shares: parseGermanNumber(row.Stück || row.stuck || '0'),
                fees: parseGermanNumber(row.Gebühren || row.gebuhren || '0'),
                taxes: parseGermanNumber(row.Steuern || row.steuern || '0'),
                notes: row.Notiz || row.notiz || ''
              }

              // Calculate price per share if available
              if (transaction.shares && transaction.shares > 0) {
                transaction.pricePerShare = Math.abs(transaction.amount) / transaction.shares
              }

              // Add asset information if available
              if (row.ISIN || row.isin || row.WKN || row.wkn || row['Ticker-Symbol'] || row.tickerSymbol || row.Symbol || row.symbol || row.Ticker || row.ticker) {
                transaction.asset = {
                  isin: row.ISIN || row.isin || '',
                  wkn: row.WKN || row.wkn || '',
                  symbol: row['Ticker-Symbol'] || row.tickerSymbol || row.Symbol || row.symbol || row.Ticker || row.ticker || '',
                  name: row.Wertpapiername || row.wertpapiername || row.Name || row.name || ''
                }

                // Log symbol extraction for debugging
                if (transaction.asset.symbol) {
                  console.log(`🎯 [CSV Parser] Extracted symbol from CSV: "${transaction.asset.symbol}" for asset: ${transaction.asset.name || transaction.asset.isin || 'Unknown'}`)
                }
              }

              transactions.push(transaction)

              // Create automatic cash adjustment for delivery transactions
              if (isDelivery && Math.abs(transaction.amount) > 0) {
                const cashAdjustment = createCashAdjustment(transaction, originalType)
                cashAdjustments.push(cashAdjustment)
                console.log(`💰 Cash adjustment: ${cashAdjustment.type} ${cashAdjustment.amount}€ for ${originalType}`)
              }
            } catch (error) {
              console.error(`❌ [CSV Parser] Error parsing transaction at row ${index + 1}:`, error, row)
            }
          })

          // Combine main transactions with cash adjustments
          const allTransactions = [...transactions, ...cashAdjustments]

          console.log(`✅ [CSV Parser] Successfully parsed ${transactions.length} transactions`)
          if (cashAdjustments.length > 0) {
            console.log(`💰 [CSV Parser] Generated ${cashAdjustments.length} automatic cash adjustments for delivery transactions`)
          }
          console.log(`📈 [CSV Parser] Final transaction types summary:`,
            allTransactions.reduce((acc, t) => {
              acc[t.type] = (acc[t.type] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          )

          resolve(allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime()))
        } catch (error) {
          console.error(`❌ [CSV Parser] Fatal error parsing CSV:`, error)
          reject(error)
        }
      },
      error: (error) => {
        console.error(`❌ [CSV Parser] Papa Parse error:`, error)
        reject(error)
      }
    })
  })
}

export const parseCashCSV = async (file: File): Promise<ProcessedTransaction[]> => {
  return new Promise((resolve, reject) => {
    console.log(`🔍 [CSV Parser] Starting to parse cash CSV: ${file.name}`)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        try {
          console.log(`📊 [CSV Parser] Raw cash CSV data:`, result.data.slice(0, 3)) // Log first 3 rows
          console.log(`📋 [CSV Parser] Cash CSV headers:`, result.meta.fields)

          const transactions: ProcessedTransaction[] = []

          result.data.forEach((row: any, index: number) => {
            try {
              console.log(`🔄 [CSV Parser] Processing cash row ${index + 1}:`, row)

              // Extract the transaction type first for debugging
              const originalType = row.Typ || row.typ || ''
              const mappedType = mapTransactionType(originalType)

              console.log(`🏷️ [CSV Parser] Cash transaction type mapping: "${originalType}" → "${mappedType}"`)

              // Special handling for Zinsen (Interest) transactions in cash CSV
              if (originalType.toLowerCase().includes('zinsen')) {
                console.log(`💰 [CSV Parser] CASH ZINSEN DETECTED! Row ${index + 1} - Original: "${originalType}", Amount: "${row.Wert || row.wert}"`)
              }

              const transaction: ProcessedTransaction = {
                id: `cash-${index}`,
                date: parseGermanDate(row.Datum || row.datum || ''),
                type: mappedType,
                amount: parseGermanNumber(row.Wert || row.wert || '0'),
                currency: row.Buchungswahrung || row.buchungswahrung || 'EUR',
                fees: parseGermanNumber(row.Gebühren || row.gebuhren || '0'),
                taxes: parseGermanNumber(row.Steuern || row.steuern || '0'),
                notes: row.Notiz || row.notiz || ''
              }

              console.log(`💰 [CSV Parser] Parsed cash transaction:`, {
                type: transaction.type,
                amount: transaction.amount,
                currency: transaction.currency,
                originalType: row.Typ || row.typ
              })

              transactions.push(transaction)
            } catch (error) {
              console.error(`❌ [CSV Parser] Error parsing cash transaction at row ${index + 1}:`, error, row)
            }
          })

          console.log(`✅ [CSV Parser] Successfully parsed ${transactions.length} cash transactions`)
          console.log(`📈 [CSV Parser] Cash transaction types summary:`,
            transactions.reduce((acc, t) => {
              acc[t.type] = (acc[t.type] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          )

          resolve(transactions.sort((a, b) => a.date.getTime() - b.date.getTime()))
        } catch (error) {
          console.error(`❌ [CSV Parser] Fatal error parsing cash CSV:`, error)
          reject(error)
        }
      },
      error: (error) => {
        console.error(`❌ [CSV Parser] Papa Parse error on cash CSV:`, error)
        reject(error)
      }
    })
  })
}

// CSV type detection removed - all transactions are processed together and separated by asset presence

export const validateCSVData = (transactions: ProcessedTransaction[]): string[] => {
  const errors: string[] = []

  if (transactions.length === 0) {
    errors.push('No valid transactions found in CSV file')
    return errors
  }

  // Check for required fields
  transactions.forEach((transaction, index) => {
    if (!transaction.date || isNaN(transaction.date.getTime())) {
      errors.push(`Invalid date in row ${index + 1}`)
    }

    if (transaction.amount === 0 && transaction.type !== 'fee' && transaction.type !== 'tax') {
      errors.push(`Zero amount in row ${index + 1}`)
    }

    if (!transaction.currency) {
      errors.push(`Missing currency in row ${index + 1}`)
    }
  })

  return errors
}
