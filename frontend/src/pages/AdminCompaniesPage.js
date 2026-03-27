import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState('ACTIVE');
  const [companySearch, setCompanySearch] = useState('');
  const [companyPage, setCompanyPage] = useState(1);
  const companiesPerPage = 10;

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
  useEffect(() => {
    setCompanyPage(1);
  }, [companyFilter, companySearch]);


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

const handleRestoreCompany = async (companyId) => {
    try {
      await api.post(`/admin/companies/${companyId}/restore`);
      toast.success('Company restored successfully.');
      loadCompanies();
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to restore company.');
    }
  };

const filteredCompanies = companies.filter((company) => {
  const status = (company.status || '').toUpperCase().trim();

  const matchesFilter =
    companyFilter === 'ACTIVE'
      ? status !== 'DELETED'
      : companyFilter === 'DELETED'
      ? status === 'DELETED'
      : true;

  const searchValue = companySearch.trim().toLowerCase();

  const matchesSearch =
    !searchValue ||
    [
      company.company_name,
      company.company_id,
      company.status,
      String(company.user_count ?? ''),
      String(company.total_lockout_count ?? ''),
    ]
      .join(' ')
      .toLowerCase()
      .includes(searchValue);

  return matchesFilter && matchesSearch;
});
  const totalCompanyPages = Math.max(
    1,
    Math.ceil(filteredCompanies.length / companiesPerPage)
  );

  const paginatedCompanies = filteredCompanies.slice(
    (companyPage - 1) * companiesPerPage,
    companyPage * companiesPerPage
  );
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
            className="h-10 px-4 rounded  bg-[#2563EB] hover:bg-[#1e40af] text-white text-sm flex items-center cursor-pointer"
          >
            Download All CSV
          </button>

          <label  className="h-10 px-4 rounded bg-slate-700 hover:bg-slate-800 text-white text-sm flex items-center cursor-pointer whitespace-nowrap" >
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

          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="h-10 px-3 rounded border border-slate-300 bg-white text-slate-900 text-sm"
          >
            <option value="ACTIVE">Active</option>
            <option value="DELETED">Deleted</option>
          </select>

          <input
            type="text"
            value={companySearch}
            onChange={(e) => setCompanySearch(e.target.value)}
            placeholder="Search companies..."
            className="h-10 px-3 rounded border border-slate-300 bg-white text-slate-900 text-sm"
          />

          <button
            type="button"
            onClick={loadCompanies}
            className="h-10 px-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
          >
            Refresh
          </button>
        </div>
          </div>

          {loading ? (
            <div className="p-6 text-slate-600">Loading companies...</div>
              ) : filteredCompanies.length === 0 ? (
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
                  {paginatedCompanies.map((company) => (
                    <tr
                      key={company.company_id}
                        className={`border-t border-slate-200 ${
                          company.status === 'DELETED' ? 'opacity-60' : ''
                        }`}
                      >
                      <td className="px-4 py-3">{company.company_name}</td>
                      <td className="px-4 py-3">{company.company_id}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
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

                            {company.status === 'SUSPENDED' && company.suspension_comment ? (
                              <div className="text-xs text-slate-600 max-w-[220px] break-words">
                                {company.suspension_comment}
                              </div>
                            ) : null}
                          </div>
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
                        {company.status === 'DELETED' && (
                          <button
                            type="button"
                            onClick={() => handleRestoreCompany(company.company_id)}
                            className="inline-flex w-28 justify-center px-2 py-1 bg-green-600 text-white rounded text-xs"
                          >
                            Restore
                          </button>
                        )}
                        {company.status === 'DELETED' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await api.delete(`/admin/companies/${company.company_id}/hard-delete`);
                                toast.success('Company permanently deleted.');
                                loadCompanies();
                              } catch (error) {
                                toast.error(error?.response?.data?.detail || 'Hard delete failed.');
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
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCompanyPage((prev) => Math.max(1, prev - 1))}
                  disabled={companyPage === 1}
                  className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm disabled:opacity-50"
                >
                  Previous
                </button>

                <span className="text-sm text-slate-600">
                  Page {companyPage} of {totalCompanyPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCompanyPage((prev) => Math.min(totalCompanyPages, prev + 1))}
                  disabled={companyPage === totalCompanyPages}
                  className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PlatformAdminLayout>
  );
}
