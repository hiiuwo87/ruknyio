import React from 'react'
import { motion } from 'framer-motion'
import { CircleCheck, ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressIndicatorProps {
  currentStep: number
  totalSteps: number
  onBack?: () => void
  onContinue?: () => void
  isLoading?: boolean
  isBackVisible?: boolean
  continueLabel?: string
  backLabel?: string
  finishLabel?: string
  disabled?: boolean
}

const ProgressIndicator = ({
  currentStep,
  totalSteps,
  onBack,
  onContinue,
  isLoading = false,
  isBackVisible = true,
  continueLabel = 'استمرار',
  backLabel = 'رجوع',
  finishLabel = 'إنهاء',
  disabled = false,
}: ProgressIndicatorProps) => {
  const isLastStep = currentStep === totalSteps
  const showBackButton = isBackVisible && currentStep > 1

  return (
    <div className="flex flex-col items-center justify-center gap-3 w-full">
      {/* Buttons container */}
      <div className="w-full max-w-md mx-auto">
        <motion.div
          className="flex items-center gap-2"
          animate={{
            justifyContent: showBackButton ? 'space-between' : 'stretch'
          }}
        >
          {showBackButton && (
            <motion.button
              type="button"
              initial={{ opacity: 0, width: 0, scale: 0.8 }}
              animate={{ opacity: 1, width: "auto", scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 15,
                mass: 0.8,
                bounce: 0.25,
                duration: 0.6,
                opacity: { duration: 0.2 }
              }}
              onClick={onBack}
              disabled={isLoading}
              className="px-6 py-3 text-foreground flex items-center justify-center gap-2 bg-muted/50 font-medium rounded-full hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRight className="h-4 w-4" />
              <span className="text-sm">{backLabel}</span>
            </motion.button>
          )}
          
          <motion.button
            type="button"
            onClick={onContinue}
            disabled={disabled || isLoading}
            animate={{
              flex: showBackButton ? 'initial' : 1,
            }}
            className={cn(
              "px-6 py-3 rounded-full text-background bg-foreground font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
              showBackButton ? 'flex-1' : 'w-full'
            )}
          >
            <div className="flex items-center font-medium justify-center gap-2 text-sm">
              {isLastStep && !isLoading && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 15,
                    mass: 0.5,
                    bounce: 0.4
                  }}
                >
                  <CircleCheck className="h-4 w-4" />
                </motion.div>
              )}
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-4 w-4 border-2 border-background/30 border-t-background rounded-full"
                  />
                  جاري المعالجة...
                </span>
              ) : (
                isLastStep ? finishLabel : continueLabel
              )}
            </div>
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}

export default ProgressIndicator
