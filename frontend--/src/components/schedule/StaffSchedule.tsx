import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, RefreshCw, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { getApiUrl, getAuthHeaders } from '@/config/api';

interface Schedule {
  id: number;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  formatted_time: string;
  branch: {
    id: number;
    name: string;
    address: string;
  };
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface StaffScheduleData {
  staff: {
    id: number;
    name: string;
    email: string;
    role: string;
    branch: {
      id: number;
      name: string;
      address: string;
    } | null;
  };
  schedules: Schedule[];
}

const StaffSchedule = () => {
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // Fetch staff schedule
  const { data: scheduleData, isLoading, error, refetch } = useQuery({
    queryKey: ['staff-schedule', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await axios.get(getApiUrl(`/staff-schedules/staff/${user.id}`), {
        headers: getAuthHeaders(),
      });
      return response.data as StaffScheduleData;
    },
    enabled: !!user?.id,
    retry: 3,
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

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const getDayName = (dayIndex: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayIndex - 1] || 'Unknown';
  };

  const getScheduleForDay = (dayOfWeek: number) => {
    return scheduleData?.schedules?.find(s => s.day_of_week === dayOfWeek);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <CardTitle>My Work Schedule</CardTitle>
            </div>
            <CardDescription>Loading schedule...</CardDescription>
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
              <CardTitle>My Work Schedule</CardTitle>
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

  if (!scheduleData) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-yellow-600" />
              <CardTitle>My Work Schedule</CardTitle>
            </div>
            <CardDescription>No schedule found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-yellow-600 mb-2">No schedule found for {user?.name}</p>
              <p className="text-sm text-gray-500">Please contact your administrator to set up your work schedule.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>My Work Schedule</CardTitle>
                <CardDescription>
                  {scheduleData.staff.branch?.name || 'No branch assigned'}
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
            <h3 className="text-lg font-semibold text-gray-900">
              Week of {weekDates[0].toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </h3>
          </div>

          {/* Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {weekDates.map((date, index) => {
              const dayOfWeek = index + 1;
              const schedule = getScheduleForDay(dayOfWeek);
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
                  {schedule ? (
                    <div className="space-y-4">
                      <Badge 
                        variant="secondary" 
                        className="w-full justify-center py-1.5 bg-green-100 text-green-800 border-green-200 font-medium"
                      >
                        Working
                      </Badge>
                      
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2 p-2 bg-green-50 rounded-lg">
                          <Clock className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-800">
                            {schedule.formatted_time}
                          </span>
                        </div>
                        
                        <div className="text-center">
                          <span className="inline-block px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                            {schedule.day_name}
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
                        Off
                      </Badge>
                      <div className="text-sm text-gray-400">
                        No schedule
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-blue-600" />
                <div>
                  <strong>Name:</strong> {scheduleData.staff.name}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <div>
                  <strong>Branch:</strong> {scheduleData.staff.branch?.name || 'Not assigned'}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                <div>
                  <strong>Working Days:</strong> {scheduleData.schedules?.length || 0} days
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Schedule List */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Schedule</CardTitle>
          <CardDescription>Complete weekly schedule breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {scheduleData.schedules && scheduleData.schedules.length > 0 ? (
            <div className="space-y-3">
              {scheduleData.schedules.map((schedule) => (
                <div 
                  key={schedule.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-20">
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                        {schedule.day_name}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-gray-900">
                        {schedule.formatted_time}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      {schedule.branch?.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedule Set</h3>
              <p className="text-gray-600">Your schedule will appear here once it's been set by your administrator.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffSchedule;

