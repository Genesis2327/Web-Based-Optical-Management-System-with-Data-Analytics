import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Calendar, User, MapPin, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  submitFeedback, 
  getAvailableAppointments, 
  getCustomerFeedback, 
  AvailableAppointment, 
  Feedback, 
  FeedbackSubmission 
} from '@/services/feedbackApi';

const CustomerFeedback = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [availableAppointments, setAvailableAppointments] = useState<AvailableAppointment[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<AvailableAppointment | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching feedback data for user:', user);
      
      const [appointmentsResponse, feedbackResponse] = await Promise.all([
        getAvailableAppointments(),
        getCustomerFeedback(user.id) // Use current user's ID
      ]);
      
      console.log('Appointments response:', appointmentsResponse);
      console.log('Feedback response:', feedbackResponse);
      
      setAvailableAppointments(appointmentsResponse.appointments);
      setFeedbackHistory(feedbackResponse.data);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to fetch data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedAppointment || rating === 0) {
      toast({
        title: "Validation Error",
        description: "Please select an appointment and provide a rating",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      const feedbackData: FeedbackSubmission = {
        appointment_id: selectedAppointment.id,
        rating,
        comment: comment.trim() || undefined,
      };

      await submitFeedback(feedbackData);
      
      toast({
        title: "Success",
        description: "Feedback submitted successfully!",
      });

      // Reset form
      setSelectedAppointment(null);
      setRating(0);
      setComment('');
      
      // Refresh data
      await fetchData();
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error ||
                          error.message || 
                          "Failed to submit feedback";
      
      const errorDetails = error.response?.data?.errors ? 
                          Object.values(error.response.data.errors).flat().join(', ') : 
                          '';
      
      toast({
        title: "Error",
        description: errorMessage + (errorDetails ? `: ${errorDetails}` : ''),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number, interactive: boolean = false) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && setRating(star)}
            className={`text-2xl ${
              interactive 
                ? 'cursor-pointer hover:scale-110 transition-transform' 
                : 'cursor-default'
            } ${
              star <= rating 
                ? 'text-yellow-400' 
                : 'text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  const getRatingDescription = (rating: number) => {
    const descriptions = {
      1: 'Very Poor',
      2: 'Poor', 
      3: 'Average',
      4: 'Good',
      5: 'Excellent'
    };
    return descriptions[rating as keyof typeof descriptions] || 'Unknown';
  };

  if (loading || !user?.id) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading feedback data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-customer">Customer Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Share your experience and help us improve our services
        </p>
      </div>

      <Tabs defaultValue="submit" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submit">Submit Feedback</TabsTrigger>
          <TabsTrigger value="history">Feedback History</TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-customer" />
                <span>Submit New Feedback</span>
              </CardTitle>
              <CardDescription>
                Select a completed appointment and share your experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Appointment Selection */}
              <div className="space-y-2">
                <Label htmlFor="appointment">Select Appointment</Label>
                <Select 
                  value={selectedAppointment?.id.toString() || ''} 
                  onValueChange={(value) => {
                    const appointment = availableAppointments.find(apt => apt.id.toString() === value);
                    setSelectedAppointment(appointment || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an appointment to review" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAppointments.map((appointment) => (
                      <SelectItem key={appointment.id} value={appointment.id.toString()}>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>{appointment.date} at {appointment.time}</span>
                          <Badge variant="outline">{appointment.type}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAppointment && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAppointment.date}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAppointment.time}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAppointment.branch_name}</span>
                      </div>
                    </div>
                    {selectedAppointment.optometrist_name && (
                      <div className="flex items-center space-x-2 mt-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedAppointment.optometrist_name}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Rating */}
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="space-y-2">
                  {renderStars(rating, true)}
                  {rating > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {getRatingDescription(rating)}
                    </p>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div className="space-y-2">
                <Label htmlFor="comment">Comments (Optional)</Label>
                <Textarea
                  id="comment"
                  placeholder="Tell us about your experience..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {comment.length}/1000 characters
                </p>
              </div>

              {/* Submit Button */}
              <Button 
                onClick={handleSubmitFeedback}
                disabled={submitting || !selectedAppointment || rating === 0}
                className="w-full"
                variant="customer"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Feedback
              </Button>
            </CardContent>
          </Card>

          {availableAppointments.length === 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Appointments Available for Feedback</h3>
                  <p className="text-muted-foreground">
                    You don't have any completed appointments that haven't been reviewed yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-customer" />
                <span>Your Feedback History</span>
              </CardTitle>
              <CardDescription>
                View all your submitted feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Appointment</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feedbackHistory.map((feedback) => (
                      <TableRow key={feedback.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">
                              {feedback.appointment?.appointment_type || 'Appointment'}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {feedback.appointment?.appointment_date} at {feedback.appointment?.appointment_time}
                            </div>
                            {feedback.appointment?.optometrist && (
                              <div className="text-xs text-muted-foreground">
                                {feedback.appointment.optometrist.name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{feedback.branch.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {renderStars(feedback.rating)}
                            <div className="text-sm text-muted-foreground">
                              {getRatingDescription(feedback.rating)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {feedback.comment ? (
                            <p className="text-sm max-w-xs truncate" title={feedback.comment}>
                              {feedback.comment}
                            </p>
                          ) : (
                            <span className="text-muted-foreground text-sm">No comment</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(feedback.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Feedback Submitted</h3>
                  <p className="text-muted-foreground">
                    You haven't submitted any feedback yet. Complete an appointment to get started!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerFeedback;

