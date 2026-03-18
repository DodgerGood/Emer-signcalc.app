import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/companies');
      setCompanies(response.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load companies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Companies
          </h1>
          <p className="text-slate-600 mt-2">
            Company records, seat counts, status, and lockout totals
          </p>
        </div>

        <div className="card-technical">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
              Company Summary
            </h2>

            <button
              type="button"
              onClick={loadCompanies}
              className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-slate-600">Loading companies...</div>
          ) : companies.length === 0 ? (
            <div className="p-6 text-slate-600">No companies found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-left px-4 py-3">Company ID</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Users / Seats</th>
                    <th className="text-left px-4 py-3">Total Lockouts</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {companies.map((company) => (
                    <tr key={company.company_id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{company.company_name}</td>
                      <td className="px-4 py-3">{company.company_id}</td>
                      <td className="px-4 py-3">{company.status}</td>
                      <td className="px-4 py-3">{company.user_count}</td>
                      <td className="px-4 py-3">{company.total_lockout_count}</td>
                      <td className="px-4 py-3">
                          <a
                            href={`/platform-admin/companies/${company.company_id}`}
                            className="inline-flex w-20 justify-center px-2 py-1 bg-slate-200 text-slate-900 rounded text-xs"
                          >
                            Open
                          </a>
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
