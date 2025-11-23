import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Calendar, Eye, X, CheckCircle } from 'lucide-react';
import { getEyewearReminders, dismissReminder, updateConditionCheck, EyewearReminder } from '@/services/eyewearReminderApi';
import { useToast } from '@/hooks/use-toast';
import EyewearConditionReportForm from './EyewearConditionReportForm';
import { useNavigate } from 'react-router-dom';

const EyewearRemindersList: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<EyewearReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReminder, setSelectedReminder] = useState<EyewearReminder | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const response = await getEyewearReminders({ is_active: true, is_dismissed: false });
      setReminders(response.reminders);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load reminders',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (reminder: EyewearReminder) => {
    try {
      await dismissReminder(reminder.id);
      toast({
        title: 'Reminder Dismissed',
        description: 'You can always submit a condition report later'
      });
      fetchReminders();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to dismiss reminder',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateCondition = async (reminder: EyewearReminder) => {
    try {
      await updateConditionCheck(reminder.id);
      setSelectedReminder(reminder);
      setShowReportForm(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update condition check',
        variant: 'destructive'
      });
    }
  };

  const handleReportSuccess = () => {
    setShowReportForm(false);
    setSelectedReminder(null);
    fetchReminders();
  };

  const isDue = (reminder: EyewearReminder) => {
    return new Date(reminder.next_reminder_date) <= new Date();
  };

  const getProductTypeLabel = (type: string) => {
    switch (type) {
      case 'frame': return 'Frames';
      case 'prescription_lens': return 'Prescription Lenses';
      case 'contact_lens': return 'Contact Lenses';
      default: return type;
    }
  };

  if (showReportForm && selectedReminder) {
    return (
      <EyewearConditionReportForm
        productId={selectedReminder.product_id}
        reservationId={selectedReminder.reservation_id}
        transactionId={selectedReminder.transaction_id}
        productType={selectedReminder.product_type}
        onSuccess={handleReportSuccess}
        onCancel={() => {
          setShowReportForm(false);
          setSelectedReminder(null);
        }}
      />
    );
  }

  if (loading) {
    return <div className="text-center py-8">Loading reminders...</div>;
  }

  if (reminders.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">No active reminders at this time.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Eyewear Condition Reminders</CardTitle>
          <CardDescription>
            Regular check-ups help maintain your eyewear and protect your vision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reminders.map((reminder) => {
              const due = isDue(reminder);
              return (
                <Card key={reminder.id} className={due ? 'border-amber-500' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">
                            {getProductTypeLabel(reminder.product_type)}
                            {reminder.product && ` - ${reminder.product.name}`}
                          </h3>
                          {due && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Due
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Next check: {new Date(reminder.next_reminder_date).toLocaleDateString()}
                            </span>
                          </div>
                          {reminder.contact_lens_expiry && (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-4 h-4" />
                              <span>
                                Expires: {new Date(reminder.contact_lens_expiry).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleUpdateCondition(reminder)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Update Condition
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDismiss(reminder)}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EyewearRemindersList;

