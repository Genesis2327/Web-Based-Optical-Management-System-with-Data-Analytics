import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface PolicyCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  policyType: 'privacy' | 'terms';
  onViewPolicy: () => void;
  error?: string;
}

export const PolicyCheckbox: React.FC<PolicyCheckboxProps> = ({
  checked,
  onCheckedChange,
  label,
  policyType,
  onViewPolicy,
  error,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-start space-x-3">
        <Checkbox
          id={`${policyType}-accept`}
          checked={checked}
          onCheckedChange={(checked) => onCheckedChange(checked === true)}
          className={`mt-1 ${error ? 'border-red-500' : ''}`}
        />
        <div className="flex-1">
          <div className="text-sm font-normal">
            <Label
              htmlFor={`${policyType}-accept`}
              className={`cursor-pointer ${error ? 'text-red-600' : 'text-gray-700'}`}
            >
              {label}
            </Label>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onViewPolicy();
              }}
              className="ml-1 text-blue-600 hover:text-blue-700 underline inline-flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              View {policyType === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'}
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 ml-7 flex items-center gap-1">
          <span className="text-red-500">●</span>
          {error}
        </p>
      )}
    </div>
  );
};

