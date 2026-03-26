import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

const PAGE_SIZE = 15;

export default function AdminBillingTrackingPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingCompanyId, setSavingCompanyId] = useState(null);

  const loadRows = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/bill-tracking');
      const sorted = (response.data || []).sort((a, b) =>
        (a.company_name || '').localeCompare(b.company_name || '')
      );
      setRows(sorted);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load bill tracking.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return rows;

    return rows.filter((row) =>
      [
        row.company_name,
        row.company_status,
        String(row.total_invoice_amount ?? ''),
        row.month_1_name,
        row.month_1_status,
        String(row.month_1_amount ?? ''),
        row.month_2_name,
        row.month_2_status,
        String(row.month_2_amount ?? ''),
        row.month_3_name,
        row.month_3_status,
        String(row.month_3_amount ?? ''),
        String(row.total_amount_due ?? ''),
      ]
        .join(' ')
        .toLowerCase()
        .includes(value)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = filteredRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const updateRowField = (companyId, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        row.company_id === companyId ? { ...row, [field]: value } : row
      )
    );
  };

  const getStatusClass = (status) => {
    const value = (status || '').toUpperCase();

    if (value === 'PAID') {
      return 'bg-green-100 text-green-800 border border-green-300';
    }
    if (value === 'UNPAID') {
      return 'bg-red-100 text-red-800 border border-red-300';
    }
    if (value === 'SUSPENDED') {
      return 'bg-amber-100 text-amber-800 border border-amber-300';
    }

    return 'bg-slate-100 text-slate-800 border border-slate-300';
  };

  const handleSaveRow = async (row) => {
    try {
      setSavingCompanyId(row.company_id);

      const payload = {
        company_id: row.company_id,
        total_invoice_amount: Number(row.total_invoice_amount || 0),
        month_1_status: row.month_1_status,
        month_1_amount: Number(row.month_1_amount || 0),
        month_2_status: row.month_2_status,
        month_2_amount: Number(row.month_2_amount || 0),
        month_3_status: row.month_3_status,
        month_3_amount: Number(row.month_3_amount || 0),
      };

      const response = await api.post('/admin/bill-tracking/upsert', payload);

      setRows((prev) =>
        prev.map((item) =>
          item.company_id === row.company_id ? response.data : item
        )
      );

      toast.success(`Saved ${row.company_name}.`);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save bill tracking row.');
    } finally {
      setSavingCompanyId(null);
    }
  };

  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Bill Tracking
          </h1>
          <p className="text-slate-600 mt-2">
            Company invoice status for the last 3 months
          </p>
        </div>

        <div className="card-technical p-6">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies..."
              className="h-10 px-3 rounded border border-slate-300 bg-white text-slate-900 text-sm"
            />

            <button
              type="button"
              onClick={loadRows}
              className="h-10 px-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card-technical p-6 text-slate-600">Loading bill tracking...</div>
        ) : filteredRows.length === 0 ? (
          <div className="card-technical p-6 text-slate-600">No companies found.</div>
        ) : (
          <div className="card-technical">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-3">Company</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">{paginatedRows[0]?.month_1_name || 'Month 1'} Status</th>
                  <th className="text-left px-4 py-3">{paginatedRows[0]?.month_1_name || 'Month 1'} Amount</th>
                  <th className="text-left px-4 py-3">{paginatedRows[0]?.month_2_name || 'Month 2'} Status</th>
                  <th className="text-left px-4 py-3">{paginatedRows[0]?.month_2_name || 'Month 2'} Amount</th>
                  <th className="text-left px-4 py-3">{paginatedRows[0]?.month_3_name || 'Month 3'} Status</th>
                  <th className="text-left px-4 py-3">{paginatedRows[0]?.month_3_name || 'Month 3'} Amount</th>
                  <th className="text-left px-4 py-3">Balance Due</th>
                  <th className="text-left px-4 py-3">Save</th>
                </tr>
                </thead>

                <tbody>
                  {paginatedRows.map((row) => (
                <tr key={row.company_id}>
                  <td className="px-4 py-3">{row.company_name}</td>

                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded bg-slate-200">
                      {row.company_status}
                    </span>
                  </td>

                  {/* Jan Status */}
                  <td className="px-4 py-3">
                    <select
                      value={row.month_1_status}
                      onChange={(e) =>
                        updateRowField(row.company_id, 'month_1_status', e.target.value)
                      }
                      className={`w-full px-3 py-2 rounded text-sm ${getStatusClass(row.month_1_status)}`}
                    >
                      <option value="PAID">Paid</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </td>

                  {/* Jan Amount */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.month_1_amount}
                      onChange={(e) =>
                        updateRowField(row.company_id, 'month_1_amount', e.target.value)
                      }
                      className="w-full max-w-[120px] px-2 py-1 border rounded"
                    />
                  </td>

                  {/* Feb Status */}
                  <td className="px-4 py-3">
                    <select
                      value={row.month_2_status}
                      onChange={(e) =>
                        updateRowField(row.company_id, 'month_2_status', e.target.value)
                      }
                      className={`w-full px-3 py-2 rounded text-sm ${getStatusClass(row.month_2_status)}`}
                    >
                      <option value="PAID">Paid</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </td>

                  {/* Feb Amount */}
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.month_2_amount}
                      onChange={(e) =>
                        updateRowField(row.company_id, 'month_2_amount', e.target.value)
                      }
                      className="w-full max-w-[120px] px-2 py-1 border rounded"
                    />
                  </td>

                  {/* Mar Status */}
                  <td className="px-4 py-3">
                    <select
                      value={row.month_3_status}
                      onChange={(e) =>
                        updateRowField(row.company_id, 'month_3_status', e.target.value)
                      }
                      className={`w-full px-3 py-2 rounded text-sm ${getStatusClass(row.month_3_status)}`}
                    >
                      <option value="PAID">Paid</option>
                      <option value="UNPAID">Unpaid</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </td>

                  {/* Mar Amount */}
                  <td className="px-4 py-3">
                    <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.month_3_amount}
                    onChange={(e) =>
                      updateRowField(row.company_id, 'month_3_amount', e.target.value)
                    }
                    className="w-full max-w-[120px] px-2 py-1 border rounded"
                  />
                </td>

                {/* Balance Due */}
                <td className="px-4 py-3 font-semibold">
                  R {Number(row.total_amount_due || 0).toFixed(2)}
                </td>

                {/* Save */}
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleSaveRow(row)}
                    className="px-3 py-2 bg-blue-600 text-white rounded"
                  >
                    Save
                  </button>
                </td>
              </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm disabled:opacity-50"
              >
                Previous
              </button>

              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </PlatformAdminLayout>
  );
}
