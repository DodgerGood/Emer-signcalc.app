import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';

export default function AdminSupportPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Platform Admin Support</h1>
          <p className="text-slate-600 mt-2">Support requests and device lock cases</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Support Requests</h2>
            <button
              type="button"
              onClick={loadRequests}
              className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-900"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-slate-600">Loading support requests...</div>
          ) : requests.length === 0 ? (
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
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{request.support_case_id || 'Legacy record'}</td>
                      <td className="px-4 py-3">{request.email}</td>
                      <td className="px-4 py-3">{request.company_name || '—'}</td>
                      <td className="px-4 py-3">{request.role || '—'}</td>
                      <td className="px-4 py-3">{request.reason}</td>
                      <td className="px-4 py-3">{request.status}</td>
                      <td className="px-4 py-3">{request.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
