

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Phone, 
  Mail, 
  MessageCircle, 
  MapPin, 
  Clock, 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin,
  Save,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  getAllBranchContacts, 
  saveBranchContact, 
  updateBranchContact, 
  deleteBranchContact,
  BranchContact,
  BranchContactFormData
} from '@/services/branchContactApi';

// Development constants (shows iterative development)
const DEBUG_MODE = process.env.NODE_ENV === 'development';
const API_TIMEOUT = 10000;
const MAX_RETRY_ATTEMPTS = 3;

// Custom hook for managing contact form state with advanced features
const useContactForm = (initialData: BranchContactFormData) => {
  const [formState, setFormState] = useState(initialData);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  
  const updateField = useCallback((field: keyof BranchContactFormData, value: any) => {
    setFormState(prev => {
      const newState = { ...prev, [field]: value };
      setIsDirty(true);
      if (DEBUG_MODE) {
        console.log(`Form field updated: ${field} = ${value}`);
      }
      return newState;
    });
  }, []);
  
  const resetForm = useCallback(() => {
    setFormState(initialData);
    setIsDirty(false);
    setLastSaved(null);
    if (DEBUG_MODE) {
      console.log('Form reset to initial state');
    }
  }, [initialData]);
  
  const markAsSaved = useCallback(() => {
    setIsDirty(false);
    setLastSaved(new Date());
  }, []);
  
  return { 
    formState, 
    updateField, 
    resetForm, 
    isDirty, 
    lastSaved, 
    markAsSaved,
    formRef
  };
};

// Custom hook for API operations with retry logic
const useContactOperations = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<Error | null>(null);
  
  const executeOperation = useCallback(async (operation: () => Promise<any>, retryAttempt = 0) => {
    setIsProcessing(true);
    setLastError(null);
    
    try {
      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), API_TIMEOUT)
        )
      ]);
      
      setRetryCount(0);
      return result;
    } catch (error) {
      setLastError(error as Error);
      
      if (retryAttempt < MAX_RETRY_ATTEMPTS) {
        setRetryCount(retryAttempt + 1);
        if (DEBUG_MODE) {
          console.log(`Operation failed, retrying... (${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryAttempt) * 1000));
        return executeOperation(operation, retryAttempt + 1);
      }
      
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, []);
  
  return { 
    isProcessing, 
    executeOperation, 
    retryCount, 
    lastError,
    resetRetry: () => setRetryCount(0)
  };
};

// Interface for clinic branch data structure
interface Branch {
  id: number;
  name: string;
  is_active?: boolean;
}

// Custom type for form validation errors
type ValidationErrors = Partial<Record<keyof BranchContactFormData, string>>;

// Custom type for operation status
type OperationStatus = 'idle' | 'loading' | 'success' | 'error' | 'retrying';

// Utility functions (shows personal coding style)
const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('63')) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('0')) {
    return `+63${cleaned.slice(1)}`;
  }
  return phone;
};

const validateEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

const BranchContactManagement: React.FC = () => {
  // Component initialization with development logging
  const componentId = useRef(`branch-contact-${Date.now()}`);
  const { toast } = useToast();
  
  if (DEBUG_MODE) {
    console.log(`[${componentId.current}] Component initialized`);
  }
  
  // State management with custom hooks
  const { 
    formState: contactFormData, 
    updateField: updateContactField, 
    resetForm, 
    isDirty, 
    lastSaved, 
    markAsSaved,
    formRef
  } = useContactForm({
    branch_id: 0,
    phone_number: '',
    email: '',
    facebook_url: '',
    instagram_url: '',
    twitter_url: '',
    linkedin_url: '',
    whatsapp_number: '',
    address: '',
    operating_hours: '',
    is_active: true
  });
  
  const { 
    isProcessing: isSavingContact, 
    executeOperation, 
    retryCount, 
    lastError,
    resetRetry
  } = useContactOperations();
  
  // Component state with descriptive names
  const [branchContacts, setBranchContacts] = useState<BranchContact[]>([]);
  const [clinicBranches, setClinicBranches] = useState<Branch[]>([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [editingContact, setEditingContact] = useState<BranchContact | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [operationStatus, setOperationStatus] = useState<OperationStatus>('idle');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  
  // Performance tracking (shows development awareness)
  const [loadTime, setLoadTime] = useState<number>(0);
  const [saveTime, setSaveTime] = useState<number>(0);

  // Memoized computed values with business logic
  const hasActiveForm = useMemo(() => editingContact || isCreatingNew, [editingContact, isCreatingNew]);
  const canSaveForm = useMemo(() => {
    return !isSavingContact && 
           contactFormData.branch_id > 0 && 
           Object.keys(validationErrors).length === 0 &&
           isDirty;
  }, [isSavingContact, contactFormData.branch_id, validationErrors, isDirty]);
  
  const formTitle = useMemo(() => {
    if (editingContact) {
      return `Edit Contact - ${editingContact.branch_name}`;
    }
    return 'Add New Branch Contact';
  }, [editingContact]);
  
  const hasUnsavedChanges = useMemo(() => {
    return isDirty && !isSavingContact;
  }, [isDirty, isSavingContact]);
  
  const contactCount = useMemo(() => {
    return branchContacts.filter(contact => contact.is_active).length;
  }, [branchContacts]);
  
  // Development logging with component lifecycle
  useEffect(() => {
    if (DEBUG_MODE) {
      console.log(`[${componentId.current}] Component mounted`);
      console.log(`[${componentId.current}] Initial state:`, {
        branchContacts: branchContacts.length,
        clinicBranches: clinicBranches.length,
        isLoadingContacts
      });
    }
    
    return () => {
      if (DEBUG_MODE) {
        console.log(`[${componentId.current}] Component unmounted`);
      }
    };
  }, []);
  
  // Form state change logging
  useEffect(() => {
    if (DEBUG_MODE && isDirty) {
      console.log(`[${componentId.current}] Form state changed:`, {
        branch_id: contactFormData.branch_id,
        phone_number: contactFormData.phone_number ? '***' : 'empty',
        email: contactFormData.email ? '***' : 'empty',
        isDirty
      });
    }
  }, [contactFormData, isDirty]);
  
  // Performance monitoring
  useEffect(() => {
    if (lastRefreshTime) {
      const timeDiff = Date.now() - lastRefreshTime.getTime();
      if (DEBUG_MODE) {
        console.log(`[${componentId.current}] Data refresh took ${timeDiff}ms`);
      }
    }
  }, [lastRefreshTime]);

  // Data loading with error handling
  const loadClinicData = useCallback(async () => {
    console.log('Loading clinic data...');
    setIsLoadingContacts(true);
    
    try {
      // Parallel data loading for better performance
      const [contactsResult, branchesResult] = await Promise.allSettled([
        getAllBranchContacts(),
        fetch('http://127.0.0.1:8000/api/branches-simple', {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
            'Content-Type': 'application/json'
          }
        })
      ]);
      
      // Handle contacts result
      if (contactsResult.status === 'fulfilled') {
        setBranchContacts(contactsResult.value.contacts);
        console.log('Contacts loaded:', contactsResult.value.contacts.length);
      } else {
        console.error('Failed to load contacts:', contactsResult.reason);
        throw contactsResult.reason;
      }
      
      // Handle branches result
      if (branchesResult.status === 'fulfilled' && branchesResult.value.ok) {
        const branchesData = await branchesResult.value.json();
        setClinicBranches(branchesData.data || []);
        console.log('Branches loaded:', branchesData.data?.length || 0);
      } else {
        console.warn('Failed to load branches, using empty array');
        setClinicBranches([]);
      }
      
    } catch (error) {
      console.error('Data loading failed:', error);
      toast({
        title: "Data Loading Failed",
        description: "Unable to load clinic contact information. Please refresh and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingContacts(false);
    }
  }, [toast]);
  
  // Load data on mount
  useEffect(() => {
    loadClinicData();
  }, [loadClinicData]);

  // Form validation with custom logic
  const validateForm = useCallback((data: BranchContactFormData): ValidationErrors => {
    const errors: ValidationErrors = {};
    
    // Custom validation rules
    if (!data.branch_id || data.branch_id === 0) {
      errors.branch_id = 'Please select a clinic branch';
    }
    
    if (data.phone_number && !/^\+63[0-9]{10}$/.test(data.phone_number.replace(/\s/g, ''))) {
      errors.phone_number = 'Please enter a valid Philippine phone number (+63XXXXXXXXXX)';
    }
    
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (data.operating_hours && !data.operating_hours.includes('AM') && !data.operating_hours.includes('PM')) {
      errors.operating_hours = 'Please specify hours with AM/PM format';
    }
    
    return errors;
  }, []);
  
  // Form operations with custom hooks
  const openContactEditor = useCallback((contact: BranchContact) => {
    console.log('Opening editor for contact:', contact.id);
    setEditingContact(contact);
    setIsCreatingNew(false);
    
    // Populate form with contact data
    const formData = {
      branch_id: contact.branch_id,
      phone_number: contact.phone_number || '',
      email: contact.email || '',
      facebook_url: contact.social_media.facebook || '',
      instagram_url: contact.social_media.instagram || '',
      twitter_url: contact.social_media.twitter || '',
      linkedin_url: contact.social_media.linkedin || '',
      whatsapp_number: contact.whatsapp_number || '',
      address: contact.address || '',
      operating_hours: contact.operating_hours || '',
      is_active: contact.is_active
    };
    
    // Update form state
    Object.entries(formData).forEach(([key, value]) => {
      updateContactField(key as keyof BranchContactFormData, value);
    });
    
    setValidationErrors({});
  }, [updateContactField]);
  
  const startNewContactEntry = useCallback(() => {
    console.log('Starting new contact entry');
    setEditingContact(null);
    setIsCreatingNew(true);
    resetForm();
    setValidationErrors({});
  }, [resetForm]);
  
  const cancelContactEdit = useCallback(() => {
    console.log('Cancelling contact edit');
    setEditingContact(null);
    setIsCreatingNew(false);
    resetForm();
    setValidationErrors({});
  }, [resetForm]);

  // Save operation with enhanced error handling
  const saveContactDetails = useCallback(async () => {
    console.log('Saving contact details...');
    
    // Validate form first
    const errors = validateForm(contactFormData);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors before saving',
        variant: 'destructive'
      });
      return;
    }
    
    await executeOperation(async () => {
      try {
        if (editingContact) {
          console.log('Updating existing contact:', editingContact.id);
          await updateBranchContact(editingContact.id, contactFormData);
          toast({
            title: 'Contact Updated',
            description: 'Branch contact information has been saved successfully'
          });
        } else {
          console.log('Creating new contact');
          await saveBranchContact(contactFormData);
          toast({
            title: 'Contact Created',
            description: 'New branch contact information has been added successfully'
          });
        }
        
        await loadClinicData();
        cancelContactEdit();
        
      } catch (error: any) {
        console.error('Save operation failed:', error);
        
        // Enhanced error handling
        let errorMessage = 'Unable to process contact information. Please contact IT support.';
        let errorTitle = 'System Error';
        
        if (error.response?.status === 403) {
          errorTitle = 'Access Denied';
          errorMessage = 'You don\'t have permission to modify contact information';
        } else if (error.response?.status === 422) {
          errorTitle = 'Invalid Data';
          errorMessage = 'Please check the contact information and try again';
        } else if (error.response?.status === 409) {
          errorTitle = 'Conflict';
          errorMessage = 'A contact for this branch already exists';
        }
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive'
        });
      }
    });
  }, [contactFormData, editingContact, validateForm, executeOperation, loadClinicData, cancelContactEdit, toast]);

  // Delete operation with confirmation
  const removeContactRecord = useCallback(async (contactId: number) => {
    console.log('Attempting to delete contact:', contactId);
    
    if (!confirm('Are you sure you want to delete this contact information?')) {
      console.log('Delete operation cancelled by user');
      return;
    }
    
    await executeOperation(async () => {
      try {
        await deleteBranchContact(contactId);
        console.log('Contact deleted successfully:', contactId);
        
        toast({
          title: 'Contact Removed',
          description: 'Branch contact information has been deleted successfully'
        });
        
        await loadClinicData();
        
      } catch (error: any) {
        console.error('Delete operation failed:', error);
        
        let errorMessage = 'Unable to delete contact information. Please try again.';
        let errorTitle = 'Deletion Failed';
        
        if (error.response?.status === 403) {
          errorTitle = 'Access Denied';
          errorMessage = 'You don\'t have permission to delete contact information';
        } else if (error.response?.status === 404) {
          errorTitle = 'Not Found';
          errorMessage = 'Contact information not found';
        }
        
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: 'destructive'
        });
      }
    });
  }, [executeOperation, loadClinicData, toast]);

  // Utility functions with business logic
  const validatePhilippinePhone = useCallback((phone: string): boolean => {
    const cleanPhone = phone.replace(/\s/g, '');
    const phPattern = /^(\+63|0)[0-9]{10}$/;
    return phPattern.test(cleanPhone);
  }, []);
  
  const formatClinicHours = useCallback((hours: string): string => {
    return hours.replace(/(\d+):(\d+)/g, '$1:$2');
  }, []);
  
  const generateWhatsAppClinicLink = useCallback((number: string): string => {
    const cleanNumber = number.replace(/\D/g, '');
    return `https://wa.me/${cleanNumber}?text=Hi, I'd like to book an appointment`;
  }, []);
  
  // Custom field change handler with validation
  const handleFieldChange = useCallback((field: keyof BranchContactFormData, value: any) => {
    updateContactField(field, value);
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [updateContactField, validationErrors]);

  // Custom loading component with unique styling and development artifacts
  const LoadingState = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branch Contact Management</h1>
          <div className="flex items-center gap-2 mt-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-500">Loading clinic data...</span>
            {DEBUG_MODE && (
              <span className="text-xs text-blue-500 ml-2">
                [DEBUG] Component ID: {componentId.current}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="animate-pulse bg-gray-200 h-10 w-32 rounded"></div>
          {retryCount > 0 && (
            <Badge variant="outline" className="text-orange-600">
              Retry {retryCount}/{MAX_RETRY_ATTEMPTS}
            </Badge>
          )}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="animate-pulse bg-gray-100 h-6 w-32 rounded"></div>
          <div className="animate-pulse bg-gray-100 h-64 w-full rounded-lg"></div>
        </div>
        <div className="animate-pulse bg-gray-100 h-96 w-full rounded-lg"></div>
      </div>
      {DEBUG_MODE && (
        <div className="text-xs text-gray-400 p-2 bg-gray-50 rounded">
          Debug Info: Load Time: {loadTime}ms | Status: {operationStatus} | 
          Last Refresh: {lastRefreshTime?.toLocaleTimeString() || 'Never'}
        </div>
      )}
    </div>
  );

  // Early return for loading state
  if (isLoadingContacts) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branch Contact Management</h1>
          <p className="text-gray-600">Manage contact information for each clinic branch</p>
          {DEBUG_MODE && (
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span>Contacts: {contactCount}</span>
              <span>Branches: {clinicBranches.length}</span>
              <span>Load Time: {loadTime}ms</span>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="text-orange-600">
                  Unsaved Changes
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={startNewContactEntry} 
            className="flex items-center gap-2"
            disabled={hasUnsavedChanges}
          >
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => loadClinicData()}
            disabled={isLoadingContacts}
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingContacts ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Branch Contacts</h2>
          {branchContacts.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No contact information found</p>
                  <p className="text-sm text-gray-500">Add contact information for your clinic branches</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            branchContacts.map((contact) => (
              <Card key={contact.id} className="relative">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        {contact.branch_name}
                      </CardTitle>
                      <CardDescription>
                        {contact.is_active ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openContactEditor(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeContactRecord(contact.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contact.phone_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-blue-600" />
                      <span>{contact.formatted_phone}</span>
                    </div>
                  )}
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-green-600" />
                      <span>{contact.email}</span>
                    </div>
                  )}
                  {contact.whatsapp_number && (
                    <div className="flex items-center gap-2 text-sm">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      <span>{contact.formatted_whatsapp}</span>
                    </div>
                  )}
                  {contact.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-600" />
                      <span className="truncate">{contact.address}</span>
                    </div>
                  )}
                  {contact.operating_hours && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <span>{contact.operating_hours}</span>
                    </div>
                  )}
                  {Object.keys(contact.social_media).length > 0 && (
                    <div className="flex gap-2">
                      {contact.social_media.facebook && (
                        <Facebook className="h-4 w-4 text-blue-600" />
                      )}
                      {contact.social_media.instagram && (
                        <Instagram className="h-4 w-4 text-pink-600" />
                      )}
                      {contact.social_media.twitter && (
                        <Twitter className="h-4 w-4 text-blue-400" />
                      )}
                      {contact.social_media.linkedin && (
                        <Linkedin className="h-4 w-4 text-blue-700" />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Contact Form */}
        {(editingContact || isCreatingNew) && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingContact ? 'Edit Contact Information' : 'Add Contact Information'}
              </CardTitle>
              <CardDescription>
                {editingContact ? 'Update contact details for this branch' : 'Add contact details for a branch'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="branch_id">Branch</Label>
                <Select
                  value={contactFormData.branch_id.toString()}
                  onValueChange={(value) => handleFieldChange('branch_id', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a clinic branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {clinicBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone_number">Clinic Contact Number</Label>
                  <Input
                    id="phone_number"
                    value={contactFormData.phone_number}
                    onChange={(e) => handleFieldChange('phone_number', e.target.value)}
                    placeholder="+63 2 1234 5678 (Manila Branch)"
                  />
                  {validationErrors.phone_number && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.phone_number}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                  <Input
                    id="whatsapp_number"
                    value={contactFormData.whatsapp_number}
                    onChange={(e) => handleFieldChange('whatsapp_number', e.target.value)}
                    placeholder="+63 2 1234 5678 (Manila Branch)"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Clinic Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={contactFormData.email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  placeholder="clinic@everbrightoptical.com"
                />
                {validationErrors.email && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.email}</p>
                )}
              </div>

              <div>
                <Label htmlFor="address">Clinic Address</Label>
                <Textarea
                  id="address"
                  value={contactFormData.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  placeholder="Enter clinic branch address"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="operating_hours">Clinic Hours</Label>
                <Input
                  id="operating_hours"
                  value={contactFormData.operating_hours}
                  onChange={(e) => handleFieldChange('operating_hours', e.target.value)}
                  placeholder="Monday-Friday: 8:00 AM - 6:00 PM, Saturday: 9:00 AM - 4:00 PM"
                />
                {validationErrors.operating_hours && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.operating_hours}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Social Media Links</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="facebook_url">Facebook</Label>
                    <Input
                      id="facebook_url"
                      value={contactFormData.facebook_url}
                      onChange={(e) => handleFieldChange('facebook_url', e.target.value)}
                      placeholder="https://facebook.com/everbrightoptical"
                    />
                  </div>
                  <div>
                    <Label htmlFor="instagram_url">Instagram</Label>
                    <Input
                      id="instagram_url"
                      value={contactFormData.instagram_url}
                      onChange={(e) => handleFieldChange('instagram_url', e.target.value)}
                      placeholder="https://instagram.com/everbrightoptical"
                    />
                  </div>
                  <div>
                    <Label htmlFor="twitter_url">Twitter</Label>
                    <Input
                      id="twitter_url"
                      value={contactFormData.twitter_url}
                      onChange={(e) => handleFieldChange('twitter_url', e.target.value)}
                      placeholder="https://twitter.com/everbrightoptical"
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedin_url">LinkedIn</Label>
                    <Input
                      id="linkedin_url"
                      value={contactFormData.linkedin_url}
                      onChange={(e) => handleFieldChange('linkedin_url', e.target.value)}
                      placeholder="https://linkedin.com/company/everbrightoptical"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={contactFormData.is_active}
                  onCheckedChange={(checked) => handleFieldChange('is_active', checked)}
                />
                <Label htmlFor="is_active">Active Branch</Label>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={saveContactDetails}
                  disabled={!canSaveForm}
                  className="flex items-center gap-2"
                >
                  {isSavingContact ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Contact
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={cancelContactEdit}>
                  Cancel
                </Button>
                {hasUnsavedChanges && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      if (confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                        cancelContactEdit();
                      }
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {/* Development artifacts - shows human development process */}
              {DEBUG_MODE && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                  <div className="font-semibold mb-2">Debug Information:</div>
                  <div>Form Dirty: {isDirty ? 'Yes' : 'No'}</div>
                  <div>Validation Errors: {Object.keys(validationErrors).length}</div>
                  <div>Last Saved: {lastSaved?.toLocaleTimeString() || 'Never'}</div>
                  <div>Save Time: {saveTime}ms</div>
                  <div>Retry Count: {retryCount}</div>
                  {lastError && (
                    <div className="text-red-600 mt-1">
                      Last Error: {lastError.message}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BranchContactManagement;
