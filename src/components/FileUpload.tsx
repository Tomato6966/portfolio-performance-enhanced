'use client'

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, FileText, Upload, X } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

import { parsePortfolioCSV, validateCSVData } from "@/lib/csvProcessor";
import { cn } from "@/lib/utils";
import { Portfolio, ProcessedTransaction } from "@/types/portfolio";

import { TransactionHistory } from "./TransactionHistory";
import { Button } from "./ui/button";

interface FileUploadProps {
  onPortfoliosCreated: (portfolios: Portfolio[]) => void
  className?: string
}

interface UploadedFile {
  file: File
  status: 'processing' | 'success' | 'error'
  data?: ProcessedTransaction[]
  errors?: string[]
  selectedTransactionIds?: string[]
}

type UploadStep = 'upload' | 'select-transactions' | 'creating-portfolios'

export const FileUpload: React.FC<FileUploadProps> = ({ onPortfoliosCreated, className }) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState<UploadStep>('upload')

  const processFile = async (file: File): Promise<UploadedFile> => {
    try {
      // Parse as portfolio CSV (contains both portfolio and cash transactions)
      const data = await parsePortfolioCSV(file)
      const errors = validateCSVData(data)

      return {
        file,
        status: errors.length > 0 ? 'error' : 'success',
        data,
        errors
      }
    } catch (error) {
      return {
        file,
        status: 'error',
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      }
    }
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsProcessing(true)

    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      status: 'processing' as const
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])

    // Process files in parallel
    const processedFiles = await Promise.all(
      acceptedFiles.map(processFile)
    )

    setUploadedFiles(prev => {
      const updated = [...prev]
      processedFiles.forEach((processed, index) => {
        const existingIndex = updated.findIndex(f => f.file === processed.file)
        if (existingIndex !== -1) {
          updated[existingIndex] = processed
        }
      })
      return updated
    })

    setIsProcessing(false)

    // Check if we have any successful files to move to transaction selection
    const hasSuccessfulFiles = processedFiles.some(file => file.status === 'success' && file.data)

    if (hasSuccessfulFiles) {
      console.log(`📋 [FileUpload] Moving to transaction selection step`)
      setCurrentStep('select-transactions')
    }
  }, [onPortfoliosCreated])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/csv': ['.csv']
    },
    multiple: true
  })

  const removeFile = (fileToRemove: File): void => {
    setUploadedFiles(prev => prev.filter(f => f.file !== fileToRemove))
  }

  const clearAll = (): void => {
    setUploadedFiles([])
    setCurrentStep('upload')
  }

  const handleTransactionSelectionChange = useCallback((fileIndex: number, selectedTransactionIds: string[]) => {
    setUploadedFiles(prev => {
      const updated = [...prev]
      if (updated[fileIndex]) {
        updated[fileIndex] = {
          ...updated[fileIndex],
          selectedTransactionIds
        }
      }
      return updated
    })
  }, [])

  // Create stable callbacks for each file to prevent infinite re-renders
  const transactionCallbacks = useMemo(() => {
    const callbacks: { [key: number]: (selectedTransactionIds: string[]) => void } = {}
    uploadedFiles.forEach((_, index) => {
      callbacks[index] = (selectedTransactionIds: string[]) => {
        handleTransactionSelectionChange(index, selectedTransactionIds)
      }
    })
    return callbacks
  }, [uploadedFiles.length, handleTransactionSelectionChange])

  const createPortfolios = async () => {
    setCurrentStep('creating-portfolios')
    setIsProcessing(true)

    try {
      const portfolios: Portfolio[] = []

      uploadedFiles.forEach(file => {
        if (file.status === 'success' && file.data) {
          // Filter transactions based on selection
          const selectedIds = new Set(file.selectedTransactionIds || [])
          const selectedTransactions = file.data.filter(t => selectedIds.has(t.id))

          // Create a clean portfolio name from the filename
          const cleanName = file.file.name
            .replace(/\.csv$/i, '') // Remove .csv extension (case insensitive)
            .replace(/[_-]/g, ' ')   // Replace underscores and hyphens with spaces
            .trim()                  // Remove leading/trailing whitespace

          const portfolioTransactions = selectedTransactions.filter(t => t.asset) || []
          const cashTransactions = selectedTransactions.filter(t => !t.asset) || []

          const portfolio: Portfolio = {
            id: crypto.randomUUID(),
            name: cleanName || 'Unnamed Portfolio',
            fileName: file.file.name,
            data: {
              transactions: portfolioTransactions, // Only selected transactions with assets
              cashTransactions: cashTransactions, // Only selected cash-only transactions
              assets: new Map(),
              startDate: new Date(),
              endDate: new Date()
            }
          }

          console.log(`📋 [FileUpload] Created portfolio: "${portfolio.name}" from file: ${file.file.name}`)
          console.log(`📊 Selected portfolio transactions (with assets): ${portfolioTransactions.length}`)
          console.log(`💰 Selected cash transactions (cash-only): ${cashTransactions.length}`)
          portfolios.push(portfolio)
        }
      })

      if (portfolios.length > 0) {
        onPortfoliosCreated(portfolios)
        // Reset state after successful creation
        setUploadedFiles([])
        setCurrentStep('upload')
      }
    } catch (error) {
      console.error('❌ [FileUpload] Error creating portfolios:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const goBackToUpload = () => {
    setCurrentStep('upload')
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Step 1: Upload Files */}
      {currentStep === 'upload' && (
        <>
          <div
            {...getRootProps()}
            className={cn(
              "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300",
              isDragActive
                ? "border-purple-400 bg-purple-500/10 glow"
                : "border-gray-600 hover:border-purple-400 hover:bg-purple-500/5",
              "glass"
            )}
          >
            <input {...getInputProps()} />

            <motion.div
              animate={{
                y: isDragActive ? -5 : 0,
                scale: isDragActive ? 1.1 : 1
              }}
              className="space-y-4"
            >
              <div className="mx-auto w-fit rounded-full bg-purple-500/20 p-4">
                <Upload className="h-8 w-8 text-purple-400" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white">
                  {isDragActive ? 'Drop files here' : 'Upload Portfolio Performance CSV Files'}
                </h3>
                <p className="text-sm text-gray-400 mt-2">
                  Drag & drop your CSV exports or click to browse
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Supports both portfolio transactions and cash account files
                </p>
              </div>
            </motion.div>

            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur-sm"
              >
                <div className="text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent mx-auto" />
                  <p className="text-sm text-white mt-2">Processing files...</p>
                </div>
              </motion.div>
            )}
          </div>
        </>
      )}

      {/* Step 2: Select Transactions */}
      {currentStep === 'select-transactions' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Select Transactions to Track</h2>
            <p className="text-gray-400">Review and select which transactions to include in your portfolios</p>
          </div>

          {uploadedFiles.filter(f => f.status === 'success').map((file, index) => (
            <div key={file.file.name} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">
                  {file.file.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' ')}
                </h3>
                <span className="text-sm text-gray-400">
                  {file.data?.length || 0} total transactions
                </span>
              </div>

              {file.data && (
                <TransactionHistory
                  transactions={file.data}
                  onTransactionSelectionChange={transactionCallbacks[index]}
                />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={goBackToUpload}
              disabled={isProcessing}
            >
              Back to Upload
            </Button>

            <Button
              onClick={createPortfolios}
              disabled={isProcessing}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isProcessing ? 'Creating Portfolios...' : 'Create Portfolios'}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Creating Portfolios */}
      {currentStep === 'creating-portfolios' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-400 border-t-transparent mx-auto" />
          <h3 className="text-lg font-semibold text-white">Creating Portfolios...</h3>
          <p className="text-gray-400">Processing selected transactions and fetching asset data</p>
        </motion.div>
      )}

      {/* Upload Step: Show file list for upload step only */}
      {currentStep === 'upload' && (
        <AnimatePresence>
          {uploadedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-white">Uploaded Files</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-gray-400 hover:text-white"
                >
                  Clear All
                </Button>
              </div>

              <div className="space-y-2">
                {uploadedFiles.map((uploadedFile, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-white">
                            {uploadedFile.file.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {(uploadedFile.file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {uploadedFile.status === 'processing' && (
                          <div className="h-4 w-4 animate-spin rounded-full border border-purple-400 border-t-transparent" />
                        )}

                        {uploadedFile.status === 'success' && (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        )}

                        {uploadedFile.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-red-400" />
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(uploadedFile.file)}
                          className="h-6 w-6 text-gray-400 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {uploadedFile.status === 'success' && uploadedFile.data && (
                      <div className="mt-2 text-xs text-green-400">
                        Successfully processed {uploadedFile.data.length} transactions
                      </div>
                    )}

                    {uploadedFile.status === 'error' && uploadedFile.errors && (
                      <div className="mt-2 space-y-1">
                        {uploadedFile.errors.map((error, errorIndex) => (
                          <p key={errorIndex} className="text-xs text-red-400">
                            {error}
                          </p>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
