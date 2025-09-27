'use client'

import { motion } from "framer-motion";
import { Calendar, ChevronDown } from "lucide-react";
import React, { useState } from "react";

import { cn } from "@/lib/utils";
import { DATE_RANGE_OPTIONS, DateRangeOption } from "@/types/portfolio";

import { Button } from "./ui/button";

interface DateRangeSelectorProps {
  startDate: Date
  endDate: Date
  maxDate: Date
  minDate: Date
  onDateRangeChange: (startDate: Date, endDate: Date) => void
  className?: string
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  startDate,
  endDate,
  maxDate,
  minDate,
  onDateRangeChange,
  className
}) => {
  const [selectedRange, setSelectedRange] = useState<string>('custom')
  const [showCustom, setShowCustom] = useState(false)

  const handleRangeSelect = (option: DateRangeOption): void => {
    const { start, end } = option.getValue(maxDate)

    // Ensure dates are within bounds
    const boundedStart = new Date(Math.max(start.getTime(), minDate.getTime()))
    const boundedEnd = new Date(Math.min(end.getTime(), maxDate.getTime()))

    setSelectedRange(option.id)
    setShowCustom(false)
    onDateRangeChange(boundedStart, boundedEnd)
  }

  const handleCustomDateChange = (type: 'start' | 'end', value: string): void => {
    const newDate = new Date(value)

    if (type === 'start') {
      onDateRangeChange(newDate, endDate)
    } else {
      onDateRangeChange(startDate, newDate)
    }
    setSelectedRange('custom')
  }

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  // Add MAX option dynamically
  const allOptions: DateRangeOption[] = [
    ...DATE_RANGE_OPTIONS,
    {
      id: 'max',
      label: 'MAX',
      getValue: () => ({ start: minDate, end: maxDate })
    }
  ]

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick Range Buttons */}
      <div className="flex flex-wrap gap-2">
        {allOptions.map((option) => (
          <Button
            key={option.id}
            variant={selectedRange === option.id ? "default" : "glass"}
            size="sm"
            onClick={() => handleRangeSelect(option)}
            className={cn(
              "transition-all duration-200",
              selectedRange === option.id
                ? "bg-purple-600 text-white glow scale-105"
                : "hover:scale-105"
            )}
          >
            {option.label}
          </Button>
        ))}

        <Button
          variant={selectedRange === 'custom' ? "default" : "glass"}
          size="sm"
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            "transition-all duration-200",
            selectedRange === 'custom'
              ? "bg-purple-600 text-white glow scale-105"
              : "hover:scale-105"
          )}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Custom
          <ChevronDown className={cn(
            "h-4 w-4 ml-2 transition-transform duration-200",
            showCustom && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Custom Date Range */}
      <motion.div
        initial={false}
        animate={{
          height: showCustom ? 'auto' : 0,
          opacity: showCustom ? 1 : 0
        }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="glass rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={formatDateForInput(startDate)}
                min={formatDateForInput(minDate)}
                max={formatDateForInput(maxDate)}
                onChange={(e) => handleCustomDateChange('start', e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded-md text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={formatDateForInput(endDate)}
                min={formatDateForInput(minDate)}
                max={formatDateForInput(maxDate)}
                onChange={(e) => handleCustomDateChange('end', e.target.value)}
                className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded-md text-white focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-colors"
              />
            </div>
          </div>

           <div className="flex items-center justify-between">
             <div className="text-sm text-gray-400">
               Selected range: {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
               <span className="ml-2">
                 ({Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days)
               </span>
             </div>
             <Button
               onClick={() => {
                 setSelectedRange('custom')
                 setShowCustom(false)
               }}
               className="bg-purple-600 hover:bg-purple-700 text-white"
               size="sm"
             >
               Apply Range
             </Button>
           </div>
         </div>
      </motion.div>

      {/* Current Selection Info */}
      <div className="glass rounded-lg p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Current Period:</span>
          <span className="text-white font-medium">
            {startDate.toLocaleDateString('de-DE')} - {endDate.toLocaleDateString('de-DE')}
          </span>
        </div>
      </div>
    </div>
  )
}
