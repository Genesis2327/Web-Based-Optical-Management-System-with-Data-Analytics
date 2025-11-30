import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  Building2,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import axios from 'axios';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl, getAuthHeaders } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

type StockReturnStatus = 'pending' | 'approved' | 'rejected' | 'processed';
type StockReturnType = 'defective' | 'damaged' | 'expired' | 'other';

interface BranchRef {
  id: number;
  name: string;
  code?: string;
}

interface ProductRef {
  id: number;
  name: string;
  sku?: string;
  category?: string;
}

interface UserRef {
  id: number;
  name: string;
}

interface StockReturn {
  id: number;
  product_id: number;
  branch_id: number;
  return_type: StockReturnType;
  quantity: number;
  unit_cost?: number | string | null;
  total_cost?: number | string | null;
  reason: string;
  return_reference?: string | null;
  status: StockReturnStatus;
  approved_by?: number | null;
  approved_at?: string | null;
  product_condition?: any;
  admin_notes?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  product?: ProductRef | null;
  branch?: BranchRef | null;
  approver?: UserRef | null;
  creator?: UserRef | null;
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

type ActionType = 'approve' | 'reject' | 'process';

const AdminStockReturns: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [returns, setReturns] = useState<StockReturn[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | StockReturnStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | StockReturnType>('all');
  const [page, setPage] = useState<number>(1);

  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<StockReturn | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    loadReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, page]);

  const loadReturns = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        params.append('return_type', typeFilter);
      }
      params.append('page', String(page));

      const response = await axios.get(getApiUrl(`/stock-returns?${params.toString()}`), {
        headers: getAuthHeaders(),
      });

      const data = response.data || {};
      setReturns(Array.isArray(data.data) ? data.data : []);
      setPagination(data.pagination || null);
    } catch (err: any) {
      console.error('Error loading stock returns:', err);
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to load stock returns';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openActionModal = (stockReturn: StockReturn, type: ActionType) => {
    setSelectedReturn(stockReturn);
    setActionType(type);
    setAdminNotes('');
    setActionModalOpen(true);
  };

  const closeActionModal = () => {
    setActionModalOpen(false);
    setSelectedReturn(null);
    setActionType(null);
    setAdminNotes('');
  };

  const handleConfirmAction = async () => {
    if (!selectedReturn || !actionType) return;

    // Reject requires notes
    if (actionType === 'reject' && !adminNotes.trim()) {
      toast({
        title: 'Notes required',
        description: 'Please provide a reason for rejecting this stock return.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmittingAction(true);

      let url = '';
      let payload: any = {};

      if (actionType === 'approve') {
        url = getApiUrl(`/stock-returns/${selectedReturn.id}/approve`);
        if (adminNotes.trim()) {
          payload.admin_notes = adminNotes.trim();
        }
      } else if (actionType === 'reject') {
        url = getApiUrl(`/stock-returns/${selectedReturn.id}/reject`);
        payload.admin_notes = adminNotes.trim();
      } else if (actionType === 'process') {
        url = getApiUrl(`/stock-returns/${selectedReturn.id}/process`);
      }

      await axios.put(url, payload, {
        headers: getAuthHeaders(),
      });

      toast({
        title: 'Success',
        description:
          actionType === 'approve'
            ? 'Stock return approved and marked for processing.'
            : actionType === 'reject'
            ? 'Stock return rejected.'
            : 'Stock return marked as processed.',
      });

      closeActionModal();
      // Refresh list
      loadReturns();
    } catch (err: any) {
      console.error('Error performing stock return action:', err);
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to update stock return status';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status: StockReturnStatus) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'processed':
        return <Badge className="bg-green-100 text-green-800">Processed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReturnTypeBadge = (type: StockReturnType) => {
    switch (type) {
      case 'defective':
        return (
          <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Defective
          </Badge>
        );
      case 'damaged':
        return (
          <Badge className="bg-orange-100 text-orange-800 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Damaged
          </Badge>
        );
      case 'expired':
        return <Badge className="bg-purple-100 text-purple-800">Expired</Badge>;
      case 'other':
      default:
        return <Badge variant="secondary">Other</Badge>;
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page. Admin access required.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center shadow">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stock Return Management</h1>
            <p className="text-slate-600">
              Review and approve stock returns for defective, damaged, or expired items.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => loadReturns()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter stock returns by status and return type.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="w-48">
            <span className="block text-sm font-medium text-slate-700 mb-1">Status</span>
            <Select
              value={statusFilter}
              onValueChange={(value: StockReturnStatus | 'all') => {
                setStatusFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-56">
            <span className="block text-sm font-medium text-slate-700 mb-1">Return Type</span>
            <Select
              value={typeFilter}
              onValueChange={(value: StockReturnType | 'all') => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="defective">Defective</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* List */}
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-slate-700" />
            <span>Stock Return Requests</span>
          </CardTitle>
          <CardDescription>
            {pagination
              ? `Showing ${returns.length} of ${pagination.total} returns`
              : 'Recent stock return requests.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
              <span className="ml-2 text-slate-600">Loading stock returns...</span>
            </div>
          ) : returns.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p>No stock return requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {returns.map((sr) => (
                <div
                  key={sr.id}
                  className="border border-slate-200 rounded-lg p-4 bg-white flex flex-col md:flex-row md:items-start md:justify-between gap-4"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {sr.product?.name || 'Unknown Product'}
                      </span>
                      {sr.product?.sku && (
                        <Badge variant="outline" className="text-xs">
                          SKU: {sr.product.sku}
                        </Badge>
                      )}
                      {getReturnTypeBadge(sr.return_type)}
                      {getStatusBadge(sr.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4 text-slate-500" />
                        <span>
                          {sr.branch?.name || 'Unknown Branch'}
                          {sr.branch?.code ? ` (${sr.branch.code})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Qty:</span> {sr.quantity}
                      </div>
                      {sr.total_cost != null && (
                        <div>
                          <span className="font-medium">Total Cost:</span>{' '}
                          ₱{Number(sr.total_cost || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Requested by:</span>{' '}
                        {sr.creator?.name || 'Unknown'}
                      </div>
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(sr.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="text-sm text-slate-700 mt-1">
                      <span className="font-medium">Reason:</span> {sr.reason}
                    </div>

                    {sr.admin_notes && (
                      <div className="text-sm text-slate-600 mt-1">
                        <span className="font-medium">Admin Notes:</span> {sr.admin_notes}
                      </div>
                    )}

                    {sr.status !== 'pending' && (
                      <div className="text-xs text-slate-500 mt-1">
                        {sr.status === 'approved' || sr.status === 'processed' ? (
                          <>
                            <span className="font-medium">Approved by:</span>{' '}
                            {sr.approver?.name || 'Unknown'}{' '}
                            {sr.approved_at && (
                              <>
                                on {new Date(sr.approved_at).toLocaleString()}
                              </>
                            )}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-stretch gap-2 min-w-[180px]">
                    {sr.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                          onClick={() => openActionModal(sr, 'approve')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500 text-red-600 hover:bg-red-50 flex items-center gap-1"
                          onClick={() => openActionModal(sr, 'reject')}
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    {sr.status === 'approved' && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 flex items-center gap-1"
                        onClick={() => openActionModal(sr, 'process')}
                      >
                        <Package className="h-4 w-4" />
                        Mark Processed
                      </Button>
                    )}
                    {sr.status === 'processed' && (
                      <Badge className="bg-green-50 text-green-700 justify-center py-1">
                        Completed
                      </Badge>
                    )}
                    {sr.status === 'rejected' && (
                      <Badge className="bg-red-50 text-red-700 justify-center py-1">
                        Rejected
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.last_page > 1 && (
            <div className="flex items-center justify-between mt-6 text-sm text-slate-600">
              <div>
                Page {pagination.current_page} of {pagination.last_page} • Total {pagination.total}{' '}
                returns
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page <= 1 || loading}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page || loading}
                  onClick={() =>
                    setPage((prev) =>
                      pagination ? Math.min(pagination.last_page, prev + 1) : prev + 1
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Modal */}
      <Dialog open={actionModalOpen} onOpenChange={(open) => !open && closeActionModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve'
                ? 'Approve Stock Return'
                : actionType === 'reject'
                ? 'Reject Stock Return'
                : 'Mark Stock Return as Processed'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' &&
                'Approve this stock return request. You can optionally add admin notes.'}
              {actionType === 'reject' &&
                'Reject this stock return request. Please provide a reason in the notes.'}
              {actionType === 'process' &&
                'Mark this approved stock return as processed once logistics are completed.'}
            </DialogDescription>
          </DialogHeader>

          {selectedReturn && (
            <div className="space-y-3 text-sm text-slate-700 mb-2">
              <div>
                <span className="font-medium">Product:</span> {selectedReturn.product?.name} (
                {selectedReturn.product?.sku || 'No SKU'})
              </div>
              <div>
                <span className="font-medium">Branch:</span> {selectedReturn.branch?.name}{' '}
                {selectedReturn.branch?.code ? `(${selectedReturn.branch.code})` : ''}
              </div>
              <div>
                <span className="font-medium">Quantity:</span> {selectedReturn.quantity}
              </div>
              <div>
                <span className="font-medium">Return Type:</span> {selectedReturn.return_type}
              </div>
            </div>
          )}

          {(actionType === 'approve' || actionType === 'reject') && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-slate-700">
                Admin Notes {actionType === 'reject' ? '(required)' : '(optional)'}
              </span>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                placeholder={
                  actionType === 'reject'
                    ? 'Explain why this stock return is being rejected.'
                    : 'Add any notes about this approval (optional).'
                }
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={closeActionModal} disabled={submittingAction}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAction} disabled={submittingAction}>
              {submittingAction
                ? 'Saving...'
                : actionType === 'approve'
                ? 'Approve'
                : actionType === 'reject'
                ? 'Reject'
                : 'Mark Processed'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStockReturns;


