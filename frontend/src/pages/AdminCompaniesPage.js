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

  const handleDownloadAllCsv = async () => {
    try {
      const response = await api.get('/admin/companies/export', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'companies_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to download CSV.');
    }
  };
  const handleDownloadCompanyCsv = async (companyId, companyName) => {
    try {
      const response = await api.get(`/admin/companies/${companyId}/export`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${(companyName || 'company').replace(/\s+/g, '_').toLowerCase()}_export.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to download company CSV.');
    }
  };

const handleUploadCompanyCsv = async (companyId, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(
        `/admin/companies/${companyId}/import`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const result = response.data;
      toast.success(
        `Upload complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
      );

      if (result.errors?.length) {
        console.error('CSV upload errors:', result.errors);
      }

      loadCompanies();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to upload company CSV.');
    }
  };

const handleBulkUploadCsv = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(
      '/admin/companies/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const result = response.data;

    toast.success(
      `Bulk upload complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
    );

    if (result.errors?.length) {
      console.error('Bulk CSV upload errors:', result.errors);
    }

    loadCompanies();
  } catch (error) {
    toast.error(error?.response?.data?.detail || 'Failed to bulk upload CSV.');
  }
};

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadAllCsv}
            className="px-3 py-1 rounded bg-[#2563EB] hover:bg-[#1e40af] text-white text-sm"
          >
            Download All CSV
          </button>

          <label className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-800 text-white text-sm cursor-pointer">
            Bulk Upload CSV
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleBulkUploadCsv(file);
                }
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={loadCompanies}
            className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
          >
            Refresh
          </button>
        </div>
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
                    <tr
                      key={company.company_id}
                        className={`border-t border-slate-200 ${
                          company.status === 'DELETED' ? 'opacity-60' : ''
                        }`}
                      >
                      <td className="px-4 py-3">{company.company_name}</td>
                      <td className="px-4 py-3">{company.company_id}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            company.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : company.status === 'SUSPENDED'
                              ? 'bg-yellow-100 text-yellow-700'
                              : company.status === 'DELETED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {company.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{company.user_count}</td>
                      <td className="px-4 py-3">{company.total_lockout_count}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2 items-start">
                          {company.status === 'DELETED' ? (
                            <span className="inline-flex w-28 justify-center px-2 py-1 bg-slate-100 text-slate-400 rounded text-xs cursor-not-allowed">
                              Open
                            </span>
                          ) : (
                            <a
                              href={`/platform-admin/companies/${company.company_id}`}
                              className="inline-flex w-28 justify-center px-2 py-1 bg-slate-200 text-slate-900 rounded text-xs"
                            >
                              Open
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadCompanyCsv(company.company_id, company.company_name)}
                            className="inline-flex w-28 justify-center px-2 py-1 bg-[#2563EB] text-white rounded text-xs"
                          >
                            Download CSV
                          </button>
                        <label className="inline-flex w-28 justify-center px-2 py-1 bg-slate-700 text-white rounded text-xs cursor-pointer hover:bg-slate-800">
                          Upload CSV
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleUploadCompanyCsv(company.company_id, file);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
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
