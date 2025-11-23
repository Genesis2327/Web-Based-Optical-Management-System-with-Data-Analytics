"use client"

import { useMemo } from "react"
import { TrendingUp, AlertCircle } from "lucide-react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Badge } from "@/components/ui/badge"

export const description = "A multiple line chart for eye progress tracking"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
} from "@/components/ui/chart"

interface EyeTrackerData {
  date: string;
  fullDate?: string;
  uniqueId?: string;
  rightEye: number;
  leftEye: number;
  visionAcuity?: string;
  condition?: string;
  progressStatus?: string;
  trackable?: boolean;
}

interface EyeTrackerLineChartProps {
  data: EyeTrackerData[];
  title?: string;
  description?: string;
  className?: string;
}

const chartConfig = {
  rightEye: {
    label: "Right Eye (OD)",
    color: "#2563eb", // Blue-600
  },
  leftEye: {
    label: "Left Eye (OS)", 
    color: "#dc2626", // Red-600
  },
} satisfies ChartConfig

export function EyeTrackerLineChart({ 
  data, 
  title = "Eye Progress Tracker",
  description,
  className 
}: EyeTrackerLineChartProps) {
  // Validate and format data
  const chartData = data.map(item => ({
    date: item.date,
    rightEye: typeof item.rightEye === 'number' ? item.rightEye : parseFloat(String(item.rightEye || '0')),
    leftEye: typeof item.leftEye === 'number' ? item.leftEye : parseFloat(String(item.leftEye || '0')),
    condition: item.condition,
    progressStatus: item.progressStatus,
    trackable: item.trackable,
  }));

  
  // Use real data from vision history
  const displayData = chartData;

  // Debug logging
  console.log('Eye Tracker - Display Data:', displayData);
  console.log('Eye Tracker - Conditions found:', displayData.map(d => ({
    date: d.date,
    condition: d.condition,
    trackable: d.trackable,
    progressStatus: d.progressStatus
  })));
  
  // Calculate trend information
  const getTrendInfo = () => {
    if (displayData.length < 2) return null;
    
    const latest = displayData[displayData.length - 1];
    const previous = displayData[displayData.length - 2];
    
    const rightEyeChange = latest.rightEye - previous.rightEye;
    const leftEyeChange = latest.leftEye - previous.leftEye;
    const avgChange = (rightEyeChange + leftEyeChange) / 2;
    
    return {
      change: avgChange,
      isPositive: avgChange <= 0, // For eye prescriptions, less negative is better
      percentage: Math.abs(avgChange).toFixed(2) // Show actual diopter change, not percentage
    };
  };

  const trendInfo = getTrendInfo();

  // Get tracked conditions
  const trackedConditions = useMemo(() => {
    const conditions = displayData
      .filter(item => item.condition && item.condition !== 'None' && item.condition !== 'Not specified')
      .map(item => ({
        date: item.date,
        condition: item.condition,
        progressStatus: item.progressStatus,
        trackable: item.trackable,
      }));
    return conditions;
  }, [displayData]);

  // Get the latest condition
  const latestCondition = trackedConditions.length > 0 
    ? trackedConditions[trackedConditions.length - 1] 
    : null;

  // Handle empty data - show message when no vision history exists
  if (!chartData || chartData.length === 0) {
    return (
      <Card className={`w-full ${className || ''}`}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Vision Data Yet</h3>
            <p className="text-gray-600 mb-4">Your eye progress will be tracked here once you have multiple prescriptions.</p>
            <p className="text-sm text-gray-500">The chart will show how your eyesight changes over time, helping you understand your vision health.</p>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className={`w-full ${className || ''}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              accessibilityLayer
              data={displayData}
              margin={{
                top: 10,
                right: 20,
                left: 10,
                bottom: 10,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => value.slice(0, 10)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${value}D`}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  const label = name === 'rightEye' ? 'Right Eye (OD)' : 'Left Eye (OS)';
                  return [`${value}D`, label];
                }}
                labelFormatter={(label) => `Date: ${label}`}
                content={(props) => {
                  const { active, payload } = props;
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    const hasCondition = data.condition && data.condition !== 'None' && data.condition !== 'Not specified';
                    
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                        <p className="font-semibold text-sm mb-2">{data.date}</p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                            <span className="text-sm">Right Eye: {data.rightEye}D</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-600"></div>
                            <span className="text-sm">Left Eye: {data.leftEye}D</span>
                          </div>
                          {hasCondition && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                                <span className="text-xs font-semibold text-amber-700">{data.condition}</span>
                              </div>
                              {data.progressStatus && data.progressStatus !== 'N/A' && (
                                <span className="text-xs text-gray-600 ml-5">Status: {data.progressStatus}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                key="rightEye"
                dataKey="rightEye"
                type="monotone"
                stroke="#2563eb"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const hasCondition = payload.condition && payload.condition !== 'None' && payload.condition !== 'Not specified';
                  // Use uniqueId for guaranteed uniqueness, fallback to fullDate + coordinates for safety
                  const uniqueKey = payload.uniqueId 
                    ? `rightEye-dot-${payload.uniqueId}` 
                    : `rightEye-dot-${payload.fullDate || payload.date}-${cx}-${cy}`;
                  return (
                    <circle
                      key={uniqueKey}
                      cx={cx}
                      cy={cy}
                      r={hasCondition ? 6 : 4}
                      fill="#2563eb"
                      stroke={hasCondition ? '#fbbf24' : '#2563eb'}
                      strokeWidth={hasCondition ? 2 : 0}
                    />
                  );
                }}
                activeDot={{
                  r: 6,
                }}
              />
              <Line
                key="leftEye"
                dataKey="leftEye"
                type="monotone"
                stroke="#dc2626"
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const hasCondition = payload.condition && payload.condition !== 'None' && payload.condition !== 'Not specified';
                  // Use uniqueId for guaranteed uniqueness, fallback to fullDate + coordinates for safety
                  const uniqueKey = payload.uniqueId 
                    ? `leftEye-dot-${payload.uniqueId}` 
                    : `leftEye-dot-${payload.fullDate || payload.date}-${cx}-${cy}`;
                  return (
                    <circle
                      key={uniqueKey}
                      cx={cx}
                      cy={cy}
                      r={hasCondition ? 6 : 4}
                      fill="#dc2626"
                      stroke={hasCondition ? '#fbbf24' : '#dc2626'}
                      strokeWidth={hasCondition ? 2 : 0}
                    />
                  );
                }}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      
      {/* Tracked Conditions Section */}
      {latestCondition && (
        <div className="px-6 pb-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Tracked Condition</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-white border-blue-300 text-blue-700">
                      {latestCondition.condition}
                    </Badge>
                    {latestCondition.progressStatus && latestCondition.progressStatus !== 'N/A' && (
                      <Badge 
                        variant={
                          latestCondition.progressStatus === 'Improving' ? 'default' : 
                          latestCondition.progressStatus === 'Stable' ? 'secondary' : 
                          'destructive'
                        }
                        className={
                          latestCondition.progressStatus === 'Improving' ? 'bg-green-100 text-green-800 border-green-300' : 
                          latestCondition.progressStatus === 'Stable' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 
                          'bg-red-100 text-red-800 border-red-300'
                        }
                      >
                        {latestCondition.progressStatus}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-blue-700">
                    {trackedConditions.length > 1 
                      ? `Tracked across ${trackedConditions.length} examinations` 
                      : 'First recorded examination'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CardFooter>
        <div className="flex w-full items-start justify-between gap-4 text-sm">
          <div className="grid gap-2">
            {trendInfo ? (
              <>
                <div className="flex items-center gap-2 font-medium leading-none">
                  {trendInfo.isPositive ? 'Improving' : 'Changing'} by {trendInfo.percentage}D 
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                  Showing vision data from {displayData.length} examination{displayData.length !== 1 ? 's' : ''}
                </div>
              </>
            ) : (
              <div className="leading-none text-muted-foreground">
                Add more examinations to see trends
              </div>
            )}
          </div>
          
          {/* Legend for condition indicators */}
          {trackedConditions.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                  <div className="absolute inset-0 w-3 h-3 rounded-full border-2 border-amber-400"></div>
                </div>
                <span>= Tracked condition</span>
              </div>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}