import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPolicyContent } from '@/utils/policyFormatter';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  version?: string;
  effectiveDate?: string;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  version,
  effectiveDate,
}) => {
  const formattedContent = formatPolicyContent(content);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">{title}</DialogTitle>
          <DialogDescription>
            {version && (
              <span className="text-sm text-gray-500">
                Version {version}
                {effectiveDate && ` • Effective ${new Date(effectiveDate).toLocaleDateString()}`}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-6 px-1">
          <div 
            className="policy-content text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        </div>
        <div className="mt-6 flex justify-end border-t pt-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

