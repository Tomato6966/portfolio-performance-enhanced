'use client'

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Database, Loader2, Search, TrendingUp, XCircle } from "lucide-react";
import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export interface AssetFetchingStatus {
  identifier: string;
  status: 'pending' | 'searching' | 'found' | 'loading_prices' | 'completed' | 'failed';
  assetName?: string;
  symbol?: string;
  priceCount?: number;
  error?: string;
}

export interface PortfolioFetchingProgress {
  portfolioName: string;
  totalAssets: number;
  completedAssets: number;
  currentAsset?: string;
  assetStatuses: AssetFetchingStatus[];
  overallStatus: 'idle' | 'processing' | 'completed' | 'error';
}

interface AssetFetchingProgressProps {
  progress: PortfolioFetchingProgress | null;
  isVisible: boolean;
}

const getStatusIcon = (status: AssetFetchingStatus['status']) => {
  switch (status) {
    case 'pending':
      return <div className="h-4 w-4 rounded-full bg-gray-600" />;
    case 'searching':
      return <Search className="h-4 w-4 text-blue-400 animate-pulse" />;
    case 'found':
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case 'loading_prices':
      return <TrendingUp className="h-4 w-4 text-purple-400 animate-pulse" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-400" />;
    default:
      return <div className="h-4 w-4 rounded-full bg-gray-600" />;
  }
};

const getStatusText = (status: AssetFetchingStatus) => {
  switch (status.status) {
    case 'pending':
      return 'Waiting...';
    case 'searching':
      return 'Searching asset...';
    case 'found':
      return `Found: ${status.assetName || 'Unknown'}`;
    case 'loading_prices':
      return 'Loading prices...';
    case 'completed':
      return `✓ ${status.priceCount || 0} prices loaded`;
    case 'failed':
      return `✗ ${status.error || 'Failed'}`;
    default:
      return 'Unknown status';
  }
};

export const AssetFetchingProgress: React.FC<AssetFetchingProgressProps> = ({
  progress,
  isVisible
}) => {
  if (!isVisible || !progress) return null;

  const progressPercentage = progress.totalAssets > 0
    ? (progress.completedAssets / progress.totalAssets) * 100
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-purple-500/20 bg-purple-950/20 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Database className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-purple-100">
                    Processing: {progress.portfolioName}
                  </CardTitle>
                  <p className="text-sm text-purple-300">
                    Loading asset data from Yahoo Finance
                  </p>
                </div>
              </div>

              {progress.overallStatus === 'processing' && (
                <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Overall Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-purple-200">
                  Progress: {progress.completedAssets} / {progress.totalAssets} assets
                </span>
                <span className="text-purple-200">
                  {progressPercentage.toFixed(0)}%
                </span>
              </div>

              <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Current Asset */}
            {progress.currentAsset && progress.overallStatus === 'processing' && (
              <div className="flex items-center space-x-2 p-3 bg-purple-900/30 rounded-lg">
                <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
                <span className="text-sm text-purple-200">
                  Currently processing: <span className="font-medium">{progress.currentAsset}</span>
                </span>
              </div>
            )}

            {/* Asset List */}
            <div className="max-h-60 overflow-y-auto space-y-2">
              {progress.assetStatuses.map((asset, index) => (
                <motion.div
                  key={asset.identifier}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                    asset.status === 'completed'
                      ? 'bg-green-900/20'
                      : asset.status === 'failed'
                      ? 'bg-red-900/20'
                      : asset.status === 'searching' || asset.status === 'loading_prices'
                      ? 'bg-blue-900/20'
                      : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(asset.status)}
                    <div>
                      <p className="text-sm font-medium text-white">
                        {asset.identifier}
                        {asset.symbol && asset.symbol !== asset.identifier && (
                          <span className="text-gray-400 ml-2">→ {asset.symbol}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {getStatusText(asset)}
                      </p>
                    </div>
                  </div>

                  {asset.status === 'completed' && asset.priceCount && (
                    <div className="text-xs text-green-400 font-medium">
                      {asset.priceCount} prices
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Summary */}
            {progress.overallStatus === 'completed' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3 bg-green-900/20 border border-green-500/20 rounded-lg"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                  <span className="text-green-200 font-medium">
                    Asset loading completed for {progress.portfolioName}
                  </span>
                </div>
                <p className="text-sm text-green-300 mt-1">
                  Successfully loaded {progress.completedAssets} out of {progress.totalAssets} assets
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
