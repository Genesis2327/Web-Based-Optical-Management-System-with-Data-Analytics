import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, X, AlertCircle } from 'lucide-react';
import { createConditionReport, uploadConditionReportPhotos, CreateConditionReportData } from '@/services/eyewearConditionApi';
import { useToast } from '@/hooks/use-toast';

interface EyewearConditionReportFormProps {
  productId?: number;
  reservationId?: number;
  transactionId?: number;
  productType?: 'frame' | 'prescription_lens' | 'contact_lens';
  onSuccess?: () => void;
  onCancel?: () => void;
}

const EyewearConditionReportForm: React.FC<EyewearConditionReportFormProps> = ({
  productId,
  reservationId,
  transactionId,
  productType = 'frame',
  onSuccess,
  onCancel
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [formData, setFormData] = useState<CreateConditionReportData>({
    product_id: productId,
    reservation_id: reservationId,
    transaction_id: transactionId,
    product_type: productType,
    condition_issues: [],
    condition_status: 'good',
    remarks: '',
    contact_lens_expiry: undefined,
    contact_lens_cycle_days: undefined,
  });

  const conditionIssues = [
    { value: 'scratched', label: 'Scratched' },
    { value: 'loose_frames', label: 'Loose Frames' },
    { value: 'blurry', label: 'Blurry Vision' },
    { value: 'irritating', label: 'Irritating/Uncomfortable' },
    { value: 'cracked', label: 'Cracked/Broken' },
    { value: 'good_condition', label: 'Good Condition' },
  ];

  const handleIssueToggle = (issue: string) => {
    setFormData(prev => {
      const issues = prev.condition_issues || [];
      const newIssues = issues.includes(issue)
        ? issues.filter(i => i !== issue)
        : [...issues, issue];
      
      // Auto-determine condition status based on issues
      let conditionStatus: CreateConditionReportData['condition_status'] = 'good';
      if (newIssues.includes('cracked') || newIssues.includes('very_blurry')) {
        conditionStatus = 'urgent';
      } else if (newIssues.includes('blurry') || newIssues.includes('irritating')) {
        conditionStatus = 'vision_affected';
      } else if (newIssues.includes('scratched') || newIssues.includes('loose_frames')) {
        conditionStatus = 'needs_repair';
      } else if (newIssues.length > 0 && !newIssues.includes('good_condition')) {
        conditionStatus = 'minor_issues';
      } else if (newIssues.includes('good_condition')) {
        conditionStatus = 'good';
      }

      return {
        ...prev,
        condition_issues: newIssues,
        condition_status: conditionStatus
      };
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 5) {
      toast({
        title: 'Too many photos',
        description: 'You can upload a maximum of 5 photos',
        variant: 'destructive'
      });
      return;
    }
    setPhotos(prev => [...prev, ...files]);
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.condition_issues.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one condition issue',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create the report
      const response = await createConditionReport(formData);
      
      // Upload photos if any
      if (photos.length > 0 && response.report.id) {
        await uploadConditionReportPhotos(response.report.id, photos);
      }

      toast({
        title: 'Success',
        description: 'Condition report submitted successfully'
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to submit condition report',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eyewear Condition Report</CardTitle>
        <CardDescription>
          Report any issues with your {productType === 'frame' ? 'frames' : productType === 'prescription_lens' ? 'prescription lenses' : 'contact lenses'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Type */}
          <div className="space-y-2">
            <Label>Product Type</Label>
            <Select
              value={formData.product_type}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, product_type: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frame">Frame</SelectItem>
                <SelectItem value="prescription_lens">Prescription Lens</SelectItem>
                <SelectItem value="contact_lens">Contact Lens</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contact Lens Specific Fields */}
          {formData.product_type === 'contact_lens' && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <div className="space-y-2">
                <Label>Contact Lens Expiry Date</Label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.contact_lens_expiry || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_lens_expiry: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Replacement Cycle (days)</Label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="30 for monthly, 90 for quarterly"
                  value={formData.contact_lens_cycle_days || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_lens_cycle_days: parseInt(e.target.value) || undefined }))}
                />
              </div>
            </div>
          )}

          {/* Condition Issues */}
          <div className="space-y-2">
            <Label>Condition Issues (Select all that apply)</Label>
            <div className="grid grid-cols-2 gap-3">
              {conditionIssues.map((issue) => (
                <div key={issue.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={issue.value}
                    checked={formData.condition_issues.includes(issue.value)}
                    onCheckedChange={() => handleIssueToggle(issue.value)}
                  />
                  <Label htmlFor={issue.value} className="font-normal cursor-pointer">
                    {issue.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Condition Status (Auto-determined, but can be overridden) */}
          <div className="space-y-2">
            <Label>Condition Status</Label>
            <Select
              value={formData.condition_status}
              onValueChange={(value: any) => setFormData(prev => ({ ...prev, condition_status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="minor_issues">Minor Issues</SelectItem>
                <SelectItem value="needs_repair">Needs Repair</SelectItem>
                <SelectItem value="vision_affected">Vision Affected</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            {formData.condition_status === 'vision_affected' || formData.condition_status === 'urgent' ? (
              <div className="flex items-center gap-2 text-amber-600 text-sm mt-2">
                <AlertCircle className="w-4 h-4" />
                <span>This will be automatically assigned to an optometrist</span>
              </div>
            ) : null}
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <Label>Photos (Optional, max 5)</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`Preview ${index + 1}`}
                    className="w-20 h-20 object-cover rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {photos.length < 5 && (
                <label className="flex items-center justify-center w-20 h-20 border-2 border-dashed rounded cursor-pointer hover:bg-gray-50">
                  <Upload className="w-6 h-6 text-gray-400" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label>Additional Remarks (Optional)</Label>
            <Textarea
              placeholder="Describe any additional issues or concerns..."
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Report'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EyewearConditionReportForm;

