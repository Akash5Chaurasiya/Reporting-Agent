"use client"

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart as RechartsScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts"

// Define a generic type for chart data
interface ChartDataItem {
  [key: string]: string | number;
}

interface ScatterPlotProps {
  data: ChartDataItem[]
  xKey: string
  yKey: string
  zKey?: string
  nameKey?: string
  colors?: string[]
  valueFormatter?: (value: number) => string
  className?: string
  showGrid?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  showLegend?: boolean
  xAxisLabel?: string
  yAxisLabel?: string
}

export function ScatterPlot({
  data,
  xKey,
  yKey,
  zKey,
  nameKey,
  colors = ["#3b82f6", "#10b981", "#6366f1", "#f59e0b", "#ef4444"],
  valueFormatter = (value: number) => `${value}`,
  className,
  showGrid = true,
  showXAxis = true,
  showYAxis = true,
  showLegend = false,
  xAxisLabel,
  yAxisLabel,
}: ScatterPlotProps) {
  // Transform data to ensure numeric values
  const formattedData = data.map((item, index) => ({
    ...item,
    x: Number(item[xKey]) || 0,
    y: Number(item[yKey]) || 0,
    z: zKey ? Number(item[zKey]) || 0 : 1,
    name: nameKey ? String(item[nameKey]) : `Point ${index + 1}`,
    color: colors[0],
  }))

  return (
    <ResponsiveContainer width="100%" height="100%" className={className}>
      <RechartsScatterChart
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
      >
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
        )}

        {showXAxis && (
          <XAxis
            type="number"
            dataKey="x"
            name={xAxisLabel || xKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            dy={10}
            tickFormatter={(value) => valueFormatter(value)}
            label={
              xAxisLabel
                ? {
                    value: xAxisLabel,
                    position: "bottom",
                    fill: "#6b7280",
                    fontSize: 12,
                    offset: 0,
                  }
                : undefined
            }
          />
        )}

        {showYAxis && (
          <YAxis
            type="number"
            dataKey="y"
            name={yAxisLabel || yKey}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            tickFormatter={(value) => valueFormatter(value)}
            label={
              yAxisLabel
                ? {
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: "#6b7280",
                    fontSize: 12,
                  }
                : undefined
            }
          />
        )}

        {zKey && (
          <ZAxis
            type="number"
            dataKey="z"
            name={zKey}
            range={[50, 400]}
            scale="sqrt"
          />
        )}

        <Tooltip
          formatter={(value: number, name: string) => [
            valueFormatter(value),
            name,
          ]}
          labelFormatter={(label) => `${label}`}
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{
            backgroundColor: "white",
            borderRadius: "0.375rem",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
            padding: "0.5rem 0.75rem",
          }}
        />

        {showLegend && (
          <Scatter
            name={yKey}
            data={formattedData}
            fill={colors[0]}
            animationDuration={500}
          />
        )}

        <Scatter
          name={yKey}
          data={formattedData}
          fill={colors[0]}
          animationDuration={500}
        />
      </RechartsScatterChart>
    </ResponsiveContainer>
  )
}
