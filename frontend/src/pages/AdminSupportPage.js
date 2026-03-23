import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminSupportPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestFilter, setRequestFilter] = useState('OPEN');


  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/support-requests');
      setRequests(response.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load support requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

const filteredRequests = requests.filter((request) => {
  const status = (request.status || '').toUpperCase().trim();

  if (requestFilter === 'OPEN') return status === 'OPEN';
  if (requestFilter === 'COMPLETED') return status === 'COMPLETED' || status === 'RESOLVED';
  if (requestFilter === 'DELETED') return status === 'DELETED';

  return true;
});

return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Platform Admin Support
          </h1>
          <p className="text-slate-600 mt-2">
            Support requests and device lock cases
          </p>
        </div>

        <div className="card-technical">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
              Support Requests
            </h2>

            <div className="flex items-center gap-2">
              <select
                value={requestFilter}
                onChange={(e) => setRequestFilter(e.target.value)}
                className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-900 text-sm"
              >
                <option value="OPEN">Open</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELETED">Deleted</option>
              </select>

              <button
                onClick={loadRequests}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
              >
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 text-slate-600">Loading support requests...</div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-6 text-slate-600">No support requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3">Case ID</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-left px-4 py-3">Role</th>
                    <th className="text-left px-4 py-3">Reason</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Created</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">
                        {request.support_case_id || 'Legacy record'}
                      </td>
                      <td className="px-4 py-3">{request.email}</td>
                      <td className="px-4 py-3">{request.company_name || '—'}</td>
                      <td className="px-4 py-3">{request.role || '—'}</td>
                      <td className="px-4 py-3">{request.reason}</td>
                      <td className="px-4 py-3">{request.status}</td>
                      <td className="px-4 py-3">{request.created_at}</td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2 items-start">
                          {request.status === 'OPEN' && (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    await api.post(
                                      `/admin/support-requests/${request.support_case_id}/action`,
                                      {
                                        action: 'APPROVE_NEW_DEVICE',
                                        resolved_by: 'Admin'
                                      }
                                    );
                                    toast.success('Device approved');
                                    loadRequests();
                                  } catch (err) {
                                    toast.error(err?.response?.data?.detail || 'Action failed');
                                  }
                                }}
                                className="inline-flex w-24 justify-center px-2 py-1 bg-green-500 text-white rounded text-xs"
                              >
                                Approve
                              </button>

                              <button
                                onClick={async () => {
                                  try {
                                    await api.post(
                                      `/admin/support-requests/${request.support_case_id}/action`,
                                      {
                                        action: 'CLEAR_LOCKOUT',
                                        resolved_by: 'Admin'
                                      }
                                    );
                                    toast.success('Lockout cleared');
                                    loadRequests();
                                  } catch (err) {
                                    toast.error(err?.response?.data?.detail || 'Action failed');
                                  }
                                }}
                                className="inline-flex w-24 justify-center px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                              >
                                Clear
                              </button>

                              <button
                                onClick={async () => {
                                  try {
                                    await api.post(
                                      `/admin/support-requests/${request.support_case_id}/action`,
                                      {
                                        action: 'FULL_RESET',
                                        resolved_by: 'Admin'
                                      }
                                    );
                                    toast.success('Full reset complete');
                                    loadRequests();
                                  } catch (err) {
                                    toast.error(err?.response?.data?.detail || 'Action failed');
                                  }
                                }}
                                className="inline-flex w-24 justify-center px-2 py-1 bg-red-500 text-white rounded text-xs"
                              >
                                Reset
                              </button>
                            </>
                          )}

                            {request.status !== 'DELETED' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const caseId = request.support_case_id;

                                    if (!caseId) {
                                      toast.error('Cannot delete legacy record (no case ID)');
                                      return;
                                    }

                                    await api.delete(`/admin/support-requests/${caseId}`);
                                    toast.success('Moved to deleted');
                                    loadRequests();
                                  } catch (err) {
                                    toast.error(err?.response?.data?.detail || 'Delete failed');
                                  }
                                }}
                                className="inline-flex w-24 justify-center px-2 py-1 bg-red-700 text-white rounded text-xs"
                              >
                                Delete
                              </button>
                            )}

                            {request.status === 'DELETED' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const caseId = request.support_case_id;

                                    if (!caseId) {
                                      toast.error('Cannot hard delete legacy record');
                                      return;
                                    }

                                    await api.delete(`/admin/support-requests/${caseId}/hard-delete`);
                                    toast.success('Permanently deleted');
                                    loadRequests();
                                  } catch (err) {
                                    toast.error(err?.response?.data?.detail || 'Hard delete failed');
                                  }
                                }}
                                className="inline-flex w-28 justify-center px-2 py-1 bg-black text-white rounded text-xs"
                              >
                                Permanent Delete
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PlatformAdminLayout>
  );
}
