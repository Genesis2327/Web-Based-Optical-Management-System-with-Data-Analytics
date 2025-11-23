import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, RefreshCw, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { optometristRotationApi } from '@/services/optometristRotationApi';
import { getActiveBranches } from '@/services/branchApi';
import { useAuth } from '@/contexts/AuthContext';

interface OptometristRotation {
  id: number;
  optometrist_id: number;
  rotation_schedule: Array<{
    day: number;
    day_name: string;
    branch_id: number;
    start_time: string;
    end_time: string;
    formatted_time: string;
  }>;
  all_branches: number[];
  is_active: boolean;
  optometrist: {
    id: number;
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

const OptometristSchedule = () => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Fetch optometrist rotations
  const { data: rotationData, isLoading, error, refetch } = useQuery({
    queryKey: ['optometrist-rotations'],
    queryFn: optometristRotationApi.getAllRotations,
  });

  // Fetch branches for display
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: getActiveBranches,
  });




  const getWeekDates = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Monday
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDates.push(day);
    }
    return weekDates;
  };

  const weekDates = getWeekDates(currentWeek);
  const today = new Date();

  const getStatusColor = (day: any, date: Date) => {
    if (!day.available) return 'bg-gray-100 text-gray-400';
    if (date.toDateString() === today.toDateString()) return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getStatusText = (day: any, date: Date) => {
    if (!day.available) return 'Not Available';
    if (date.toDateString() === today.toDateString()) return 'Today';
    return 'Available';
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayOfWeek - 1] || 'Unknown';
  };

  const getBranchName = (branchId: number) => {
    const branch = branchesData?.find(b => b.id === branchId);
    return branch?.name || `Branch ${branchId}`;
  };




  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <CardTitle>Optometrist Schedule</CardTitle>
            </div>
            <CardDescription>Loading weekly schedule...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-red-600" />
              <CardTitle>Optometrist Schedule</CardTitle>
            </div>
            <CardDescription>Error loading schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">Failed to load schedule data</p>
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const weeklySchedule = rotationData?.rotations || [];
  const currentUserRotation = weeklySchedule.find((rotation: OptometristRotation) => 
    rotation.optometrist_id === user?.id
  );

  if (!currentUserRotation) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-yellow-600" />
              <CardTitle>Optometrist Schedule</CardTitle>
            </div>
            <CardDescription>No rotation schedule found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-yellow-600">No rotation schedule found for {user?.name}</p>
              <p className="text-sm text-gray-500 mt-2">Please contact your administrator to set up your rotation schedule.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="space-y-6">
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>{user?.name} - Weekly Rotation Schedule</CardTitle>
                <CardDescription>
                  Weekly rotation across {currentUserRotation.all_branches.length} branches
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
              >
                ← Previous Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentWeek(new Date())}
              >
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
              >
                Next Week →
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Week of {weekDates[0].toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </h3>
            </div>
          </div>

          {/* Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDates.map((date, index) => {
              const dayOfWeek = index + 1;
              const rotationDay = currentUserRotation.rotation_schedule.find(schedule => schedule.day === dayOfWeek);
              const isToday = date.toDateString() === today.toDateString();
              
              return (
                <div
                  key={date.toISOString()}
                  className={`border rounded-xl p-4 relative transition-all duration-200 hover:shadow-md ${
                    isToday ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {/* Day Header */}
                  <div className="text-center mb-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-2xl font-bold ${
                      isToday ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {date.getDate()}
                    </div>
                    {isToday && (
                      <div className="text-xs text-blue-500 font-medium mt-1">Today</div>
                    )}
                  </div>

                  {/* Schedule Content */}
                  {rotationDay ? (
                    <div className="space-y-4">
                      <Badge 
                        variant="secondary" 
                        className="w-full justify-center py-1.5 bg-green-100 text-green-800 border-green-200 font-medium"
                      >
                        Available
                      </Badge>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-lg">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-800">
                            {getBranchName(rotationDay.branch_id)}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-800">
                            {rotationDay.formatted_time}
                          </span>
                        </div>
                        
                        <div className="text-center">
                          <span className="inline-block px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                            {rotationDay.day_name}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <Badge 
                        variant="secondary" 
                        className="w-full justify-center py-1.5 bg-gray-100 text-gray-500 font-medium"
                      >
                        Not Available
                      </Badge>
                      <div className="flex items-center justify-center space-x-2 text-gray-400">
                        <X className="h-4 w-4" />
                        <span className="text-sm">No work scheduled</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-900 mb-2">Schedule Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Total Working Days:</strong> {currentUserRotation.rotation_schedule.length} days
              </div>
              <div>
                <strong>Branches Covered:</strong> {currentUserRotation.all_branches.length} branches
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default OptometristSchedule;
