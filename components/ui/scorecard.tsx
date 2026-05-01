"use client"

import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp, Minus } from "lucide-react"

interface ScorecardProps {
  title: string
  value: number | string
  previousValue?: number
  changeLabel?: string
  trend?: "up" | "down" | "neutral"
  format?: "number" | "currency" | "percentage" | "duration"
  icon?: React.ReactNode
  className?: string
  variant?: "default" | "gradient" | "minimal"
  size?: "sm" | "md" | "lg"
}

function formatValue(value: number | string, format?: string): string {
  if (typeof value === "string") return value

  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    case "percentage":
      return `${value.toFixed(1)}%`
    case "duration":
      if (value < 60) return `${value}s`
      const minutes = Math.floor(value / 60)
      const seconds = Math.floor(value % 60)
      return `${minutes}:${seconds.toString().padStart(2, "0")}`
    case "number":
    default:
      return new Intl.NumberFormat("en-US").format(value)
  }
}

function calculateChange(current: number, previous: number): { value: number; trend: "up" | "down" | "neutral" } {
  if (previous === 0) {
    return { value: 0, trend: "neutral" }
  }
  const change = ((current - previous) / previous) * 100
  return {
    value: Math.abs(change),
    trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  }
}

export function Scorecard({
  title,
  value,
  previousValue,
  changeLabel,
  trend: explicitTrend,
  format = "number",
  icon,
  className,
  variant = "default",
  size = "md",
}: ScorecardProps) {
  // Calculate trend if previousValue provided
  let calculatedTrend: "up" | "down" | "neutral" = explicitTrend || "neutral"
  let changePercent = 0

  if (previousValue !== undefined && explicitTrend === undefined) {
    const { value: change, trend } = calculateChange(Number(value), previousValue)
    changePercent = change
    calculatedTrend = trend
  } else if (explicitTrend) {
    calculatedTrend = explicitTrend
  }

  const trendIcon = {
    up: <TrendingUp className="h-4 w-4" />,
    down: <TrendingDown className="h-4 w-4" />,
    neutral: <Minus className="h-4 w-4" />,
  }

  const trendColor = {
    up: "text-emerald-600",
    down: "text-red-600",
    neutral: "text-muted-foreground",
  }

  const bgGradient = {
    default: "",
    gradient: "bg-gradient-to-br from-card to-primary/5",
    minimal: "",
  }

  const sizeClasses = {
    sm: {
      title: "text-xs",
      value: "text-2xl",
      padding: "p-4",
    },
    md: {
      title: "text-sm",
      value: "text-3xl",
      padding: "p-5",
    },
    lg: {
      title: "text-base",
      value: "text-4xl",
      padding: "p-6",
    },
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50",
        bgGradient[variant],
        sizeClasses[size].padding,
        className
      )}
    >
      {/* Decorative corner accent */}
      {variant === "default" && (
        <div className="absolute -right-8 -top-8 h-24 w-24 rotate-45 bg-primary/5" />
      )}

      <div className="relative z-10 flex flex-col gap-3">
        {/* Title row with optional icon */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "font-medium text-muted-foreground",
              sizeClasses[size].title
            )}
          >
            {title}
          </span>
          {icon && (
            <div className="text-muted-foreground/60">{icon}</div>
          )}
        </div>

        {/* Value */}
        <div className={cn("font-bold tracking-tight text-foreground", sizeClasses[size].value)}>
          {formatValue(value, format)}
        </div>

        {/* Trend indicator */}
        {(calculatedTrend !== "neutral" || changeLabel) && (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium",
                trendColor[calculatedTrend]
              )}
            >
              {trendIcon[calculatedTrend]}
              {changePercent > 0 && changePercent.toFixed(1)}%
            </div>
            {changeLabel && (
              <span className="text-xs text-muted-foreground">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
