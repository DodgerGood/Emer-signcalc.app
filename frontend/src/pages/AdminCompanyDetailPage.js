import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminCompanyDetailPage() {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/companies/${companyId}`);
      setCompany(response.data);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load company details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();
  }, [companyId]);

  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            {company?.company_name || 'Company Detail'}
          </h1>
          <p className="text-slate-600 mt-2">
            Seats, roles, and lockout tracking
          </p>
        </div>

        {loading ? (
          <div className="card-technical p-6 text-slate-600">Loading company details...</div>
        ) : !company ? (
          <div className="card-technical p-6 text-slate-600">Company not found.</div>
        ) : (
          <>
            <div className="card-technical p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Company</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.company_name}</div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Status</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.status}</div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Users / Seats</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.user_count}</div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-500">Total Lockouts</div>
                  <div className="text-xl font-bold text-slate-900 mt-1">{company.total_lockout_count}</div>
                </div>
              </div>
            </div>

            <div className="card-technical">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                  Seats / Users
                </h2>

                <button
                  type="button"
                  onClick={loadCompany}
                  className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
                >
                  Refresh
                </button>
              </div>

              {company.users.length === 0 ? (
                <div className="p-6 text-slate-600">No users found for this company.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-slate-700">
                      <tr>
                        <th className="text-left px-4 py-3">Full Name</th>
                        <th className="text-left px-4 py-3">Email</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">Status</th>
                        <th className="text-left px-4 py-3">Device ID</th>
                        <th className="text-left px-4 py-3">Device Lock Until</th>
                        <th className="text-left px-4 py-3">Lockout Until</th>
                        <th className="text-left px-4 py-3">Lockout Count</th>
                        <th className="text-left px-4 py-3">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {company.users.map((user) => (
                        <tr key={user.user_id} className="border-t border-slate-200">
                          <td className="px-4 py-3">{user.full_name || '—'}</td>
                          <td className="px-4 py-3">{user.email}</td>
                          <td className="px-4 py-3">{user.role || '—'}</td>
                          <td className="px-4 py-3">{user.status}</td>
                          <td className="px-4 py-3">{user.device_id || '—'}</td>
                          <td className="px-4 py-3">{user.device_lock_until || '—'}</td>
                          <td className="px-4 py-3">{user.lockout_until || '—'}</td>
                          <td className="px-4 py-3">{user.lockout_count}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2 items-start">
                              <button
                                type="button"
                                className="inline-flex w-24 justify-center px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                              >
                                Suspend
                              </button>
                              <button
                                type="button"
                                className="inline-flex w-24 justify-center px-2 py-1 bg-slate-500 text-white rounded text-xs"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="inline-flex w-24 justify-center px-2 py-1 bg-red-500 text-white rounded text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PlatformAdminLayout>
  );
}
