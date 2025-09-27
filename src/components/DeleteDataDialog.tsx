'use client'

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Database, Trash2, X } from "lucide-react";
import React from "react";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface DeleteDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  portfolioCount: number;
  storageSize?: number;
}

export const DeleteDataDialog: React.FC<DeleteDataDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  portfolioCount,
  storageSize
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <Card className="w-full max-w-md border-red-500/20 bg-red-950/20 backdrop-blur-xl">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-red-500/20">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <CardTitle className="text-red-100">Delete Portfolio Data</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg">
                  <Database className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-white">
                      {portfolioCount} {portfolioCount === 1 ? 'Portfolio' : 'Portfolios'}
                    </p>
                    {storageSize && (
                      <p className="text-xs text-gray-400">
                        {storageSize} KB stored locally
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-red-200">
                    Are you sure you want to delete all portfolio data?
                  </p>
                  <ul className="text-xs text-gray-400 space-y-1 pl-4">
                    <li>• All uploaded CSV files and their data</li>
                    <li>• Portfolio calculations and summaries</li>
                    <li>• Performance history and charts</li>
                    <li>• All settings and selections</li>
                  </ul>
                  <p className="text-xs text-red-300 font-medium">
                    This action cannot be undone.
                  </p>
                </div>

                <div className="flex space-x-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={onClose}
                    className="flex-1 text-gray-400 hover:text-white hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
