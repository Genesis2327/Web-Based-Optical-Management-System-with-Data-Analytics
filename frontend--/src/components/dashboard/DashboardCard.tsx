import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface DashboardCardProps {
  title: string;
  description?: string;
  tooltip?: string; // Tooltip text to explain the metric
  value?: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'admin' | 'staff' | 'optometrist' | 'customer';
  };
  className?: string;
  gradient?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  description,
  tooltip,
  value,
  icon: Icon,
  trend,
  action,
  className,
  gradient
}) => {
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <Card className={cn(
      'border border-gray-200 shadow-sm',
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          {tooltip && (
            <div className="relative group">
              <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" 
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)} />
              {showTooltip && (
                <div className="absolute z-50 left-0 top-5 w-64 p-2 text-xs text-white bg-gray-900 rounded-md shadow-lg pointer-events-none">
                  {tooltip}
                </div>
              )}
            </div>
          )}
        </div>
        <Icon className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {value && (
            <div className="text-2xl font-semibold text-gray-900">{value}</div>
          )}
          
          {description && (
            <CardDescription className="text-gray-500 text-sm">
              {description}
            </CardDescription>
          )}
          
          {trend && (
            <div className="flex items-center text-sm">
              <span className={cn(
                'font-medium',
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              )}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-gray-500 ml-1">{trend.label}</span>
            </div>
          )}
          
          {action && (
            <Button
              onClick={action.onClick}
              variant="outline"
              size="sm"
              className="w-full mt-3"
            >
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
