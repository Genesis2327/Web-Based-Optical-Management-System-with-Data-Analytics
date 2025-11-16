import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { optometristRotationApi } from '@/services/optometristRotationApi';
import { getActiveBranches } from '@/services/branchApi';
import { useToast } from '@/hooks/use-toast';

interface DoctorScheduleModalProps {
  doctorId: number;
  doctorName: string;
  children: React.ReactNode;
}

export const DoctorScheduleModal: React.FC<DoctorScheduleModalProps> = ({
  doctorId,
  doctorName,
  children
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getDayNameFromNumber = (dayNumber: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber === 7 ? 0 : dayNumber - 1];
  };

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      // Fetch branches and rotations
      const [branchesData, rotationsData] = await Promise.all([
        getActiveBranches(),
        optometristRotationApi.getAllRotations()
      ]);

      // Find the rotation for this doctor
      const rotation = rotationsData?.rotations?.find((r: any) => r.optometrist_id === doctorId);
      
      if (rotation && rotation.rotation_schedule) {
        const scheduleItems = rotation.rotation_schedule.map((scheduleItem: any) => {
          const branch = branchesData.find((b: any) => b.id === scheduleItem.branch_id);
          return {
            day: getDayNameFromNumber(scheduleItem.day),
            branch: branch?.name || `Branch ${scheduleItem.branch_id}`,
            time: `${scheduleItem.start_time} - ${scheduleItem.end_time}`
          };
        });

        setSchedule({
          doctor: {
            name: doctorName,
            email: rotation.optometrist?.email || ''
          },
          schedule: scheduleItems
        });
      } else {
        setSchedule(null);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
      toast({
        title: "Error",
        description: "Failed to fetch doctor schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !schedule) {
      fetchSchedule();
    }
  };

  const getStatusBadge = (scheduleItem: any) => {
    if (scheduleItem.branch === 'Not Available') {
      return <Badge variant="secondary">Not Available</Badge>;
    }
    return <Badge variant="default">Available</Badge>;
  };

  const getTimeColor = (scheduleItem: any) => {
    if (scheduleItem.branch === 'Not Available') {
      return 'text-muted-foreground';
    }
    return 'text-green-600 font-medium';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {doctorName}'s Weekly Schedule
          </DialogTitle>
          <DialogDescription>
            View the optometrist's 6-day rotation schedule across all branches
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : schedule ? (
            <>
              {/* Doctor Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {schedule.doctor.name}
                  </CardTitle>
                  <CardDescription>{schedule.doctor.email}</CardDescription>
                </CardHeader>
              </Card>

              {/* Schedule Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Day</TableHead>
                      <TableHead className="w-[150px]">Branch</TableHead>
                      <TableHead className="w-[200px]">Time</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedule.schedule.map((scheduleItem, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {scheduleItem.day}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {scheduleItem.branch}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className={getTimeColor(scheduleItem)}>
                              {scheduleItem.time}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(scheduleItem)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2">
                      <strong>Schedule Summary:</strong> {schedule.doctor.name} works a 6-day rotation 
                      across multiple branches, providing comprehensive eye care services.
                    </p>
                    <p>
                      <strong>Note:</strong> Saturday hours are typically shorter. 
                      Please book your appointment accordingly.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No schedule data available</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

