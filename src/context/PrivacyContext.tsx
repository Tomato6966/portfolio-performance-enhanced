'use client'

import React, { createContext, ReactNode, useContext, useState } from "react";

interface PrivacyContextType {
  showAbsoluteValues: boolean
  setShowAbsoluteValues: (show: boolean) => void
  togglePrivacy: () => void
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export const usePrivacy = (): PrivacyContextType => {
  const context = useContext(PrivacyContext)
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider')
  }
  return context
}

interface PrivacyProviderProps {
  children: ReactNode
}

export const PrivacyProvider: React.FC<PrivacyProviderProps> = ({ children }) => {
  const [showAbsoluteValues, setShowAbsoluteValues] = useState(true)

  const togglePrivacy = () => {
    setShowAbsoluteValues(prev => !prev)
  }

  return (
    <PrivacyContext.Provider
      value={{
        showAbsoluteValues,
        setShowAbsoluteValues,
        togglePrivacy
      }}
    >
      {children}
    </PrivacyContext.Provider>
  )
}

// Blur bar component for hiding values
export const BlurBar: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = "w-16",
  height = "h-4",
  className = ""
}) => (
  <span className={`inline-block ${width} ${height} bg-gradient-to-r from-gray-600 to-gray-500 rounded animate-pulse ${className}`} />
)

// Privacy-aware currency formatter
export const formatCurrencyPrivate = (amount: number, showAbsolute: boolean): React.ReactNode => {
  if (showAbsolute) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount)
  }
  return <BlurBar width="w-12" height="h-4" />
}
