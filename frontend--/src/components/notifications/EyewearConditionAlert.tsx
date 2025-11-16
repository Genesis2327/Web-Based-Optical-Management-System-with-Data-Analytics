import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Wrench, RefreshCw, X, Eye, Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface EyewearConditionAlert {
  id: string;
  eyewear_label: string;
  condition: 'good' | 'needs_fix' | 'needs_replacement' | 'bad';
  assessment_date: string;
  next_check_date?: string;
  notes?: string;
  assessed_by: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
}

interface EyewearConditionAlertProps {
  notification: EyewearConditionAlert;
  onDismiss?: (id: string) => void;
}

const EyewearConditionAlert: React.FC<EyewearConditionAlertProps> = ({ 
  notification, 
  onDismiss 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const getConditionIcon = (condition: string) => {
    switch (condition) {
      case 'good': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'needs_fix': return <Wrench className="h-5 w-5 text-yellow-500" />;
      case 'needs_replacement': return <RefreshCw className="h-5 w-5 text-orange-500" />;
      case 'bad': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Eye className="h-5 w-5 text-blue-500" />;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'good': return 'border-green-200 bg-green-50';
      case 'needs_fix': return 'border-yellow-200 bg-yellow-50';
      case 'needs_replacement': return 'border-orange-200 bg-orange-50';
      case 'bad': return 'border-red-200 bg-red-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConditionText = (condition: string) => {
    switch (condition) {
      case 'good': return 'Good Condition';
      case 'needs_fix': return 'Needs Repair';
      case 'needs_replacement': return 'Needs Replacement';
      case 'bad': return 'Poor Condition';
      default: return condition;
    }
  };

  const getActionMessage = (condition: string) => {
    switch (condition) {
      case 'bad': return 'Immediate attention required';
      case 'needs_replacement': return 'Replacement recommended';
      case 'needs_fix': return 'Repair recommended';
      case 'good': return 'No action needed';
      default: return '';
    }
  };

  const handleDismiss = async () => {
    setIsVisible(false);
    
    try {
      // Mark as read in backend
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notification_id: notification.id })
      });
      
      onDismiss?.(notification.id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleScheduleCheck = () => {
    toast({
      title: "Schedule Eyewear Check",
      description: "Redirecting to appointment booking...",
    });
    
    // Navigate to appointment booking with pre-filled data
    navigate('/customer/appointments', { 
      state: { 
        prefill: {
          type: 'follow_up',
          notes: `Eyewear condition check for ${notification.eyewear_label}`
        }
      }
    });
  };

  const handleViewDetails = () => {
    setIsExpanded(!isExpanded);
  };

  if (!isVisible) return null;

  return (
    <Card className={`mb-4 animate-in slide-in-from-top-2 duration-300 ${getConditionColor(notification.condition)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getConditionIcon(notification.condition)}
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Eyewear Condition Assessment
                <Badge variant="outline" className="text-xs">
                  {getConditionText(notification.condition)}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Assessed by {notification.assessed_by || 'Staff'} • {notification.assessment_date ? formatDistanceToNow(new Date(notification.assessment_date), { addSuffix: true }) : 'Recently'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getPriorityColor(notification.priority)}>
              {notification.priority?.toUpperCase() || 'MEDIUM'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Eye className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{notification.eyewear_label || 'Eyewear'}</span>
          </div>

          <div className="text-sm text-gray-700 bg-white p-3 rounded-md border">
            <strong>Status:</strong> {getConditionText(notification.condition)}
            <br />
            <strong>Action:</strong> {getActionMessage(notification.condition)}
          </div>

          {notification.notes && (
            <div className="text-sm text-gray-700 bg-white p-3 rounded-md border">
              <strong>Notes:</strong> {notification.notes}
            </div>
          )}

          {notification.next_check_date && (
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <strong>Next recommended check:</strong> {new Date(notification.next_check_date).toLocaleDateString()}
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            {notification.condition !== 'good' && (
              <Button size="sm" onClick={handleScheduleCheck}>
                Schedule Check
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleViewDetails}>
              {isExpanded ? 'Less Details' : 'More Details'}
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-3 p-3 bg-white rounded-md border">
              <h4 className="font-medium mb-2">Assessment Details</h4>
              <div className="text-sm space-y-1">
                <p><strong>Assessment Date:</strong> {notification.assessment_date ? new Date(notification.assessment_date).toLocaleString() : 'N/A'}</p>
                <p><strong>Condition:</strong> {getConditionText(notification.condition)}</p>
                <p><strong>Priority:</strong> {notification.priority || 'Medium'}</p>
                <p><strong>Assessed By:</strong> {notification.assessed_by || 'Staff'}</p>
                {notification.next_check_date && (
                  <p><strong>Next Check:</strong> {new Date(notification.next_check_date).toLocaleDateString()}</p>
                )}
                {notification.notes && (
                  <p><strong>Notes:</strong> {notification.notes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EyewearConditionAlert;
