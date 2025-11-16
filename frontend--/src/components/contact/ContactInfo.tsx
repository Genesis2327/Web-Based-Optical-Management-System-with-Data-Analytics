import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Building2,
  AlertCircle
} from 'lucide-react';
import { BranchContact, getMyBranchContact } from '@/services/branchContactApi';

interface ContactInfoProps {
  className?: string;
  showTitle?: boolean;
}

const ContactInfo: React.FC<ContactInfoProps> = ({ 
  className = '', 
  showTitle = true 
}) => {
  const [contact, setContact] = useState<BranchContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContact = async () => {
      try {
        setLoading(true);
        
        // Try to get contact from API first
        try {
          const response = await getMyBranchContact();
          setContact(response.contact);
          return;
        } catch (apiError) {
          console.log('API not available, using fallback contact info');
        }
        
        // Fallback: Use default contact information
        const fallbackContact: BranchContact = {
          id: 1,
          branch_id: 1,
          branch_name: 'Everbright Optical',
          phone_number: '+63 123 456 7890',
          formatted_phone: '+63 123 456 7890',
          email: 'info@everbrightoptical.com',
          whatsapp_number: '+63 123 456 7890',
          formatted_whatsapp: '+63 123 456 7890',
          whatsapp_link: 'https://wa.me/631234567890',
          address: '123 Main Street, Makati City',
          operating_hours: 'Mon-Fri: 8AM-6PM, Sat: 9AM-4PM',
          social_media: {
            facebook: 'https://facebook.com/everbrightoptical',
            instagram: 'https://instagram.com/everbrightoptical'
          },
          is_active: true
        };
        
        setContact(fallbackContact);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contact information');
        console.error('Error fetching contact:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, []);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          {showTitle && (
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Contact Information
            </CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !contact) {
    return (
      <Card className={className}>
        <CardHeader>
          {showTitle && (
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Contact Information
            </CardTitle>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">
              {error || 'Contact information not available'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        {showTitle && (
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Contact Information
          </CardTitle>
        )}
        <CardDescription>{contact.branch_name}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Phone Number */}
        {contact.phone_number && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <Phone className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">Phone</p>
              <p className="text-sm text-blue-700">{contact.formatted_phone}</p>
            </div>
          </div>
        )}

        {/* Email */}
        {contact.email && (
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <Mail className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">Email</p>
              <p className="text-sm text-green-700">{contact.email}</p>
            </div>
          </div>
        )}

        {/* Address */}
        {contact.address && (
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <MapPin className="h-4 w-4 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Address</p>
              <p className="text-sm text-gray-700">{contact.address}</p>
            </div>
          </div>
        )}

        {/* Operating Hours */}
        {contact.operating_hours && (
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <Clock className="h-4 w-4 text-gray-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Operating Hours</p>
              <p className="text-sm text-gray-700">{contact.operating_hours}</p>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default ContactInfo;
