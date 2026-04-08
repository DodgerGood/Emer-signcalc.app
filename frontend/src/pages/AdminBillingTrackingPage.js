import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

const PAGE_SIZE = 15;
const AUTOSAVE_INTERVAL_MS = 30000;

const getMonthStatusClass = (status) => {
  const value = String(status || '').toUpperCase();

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

const getCompanyStatusClass = (status) => {
  const value = String(status || '').toUpperCase();

  if (value === 'ACTIVE') {
    return 'bg-green-100 text-green-800 border border-green-300';
  }
  if (value === 'SUSPENDED') {
    return 'bg-amber-100 text-amber-800 border border-amber-300';
  }
  if (value === 'DELETED') {
    return 'bg-red-100 text-red-800 border border-red-300';
  }

  return 'bg-slate-100 text-slate-800 border border-slate-300';
};

const calculateTotalAmountDue = (row) => {
  const month1 =
    String(row.month_1_status || '').toUpperCase() === 'UNPAID'
      ? Number(row.month_1_amount || 0)
      : 0;

  const month2 =
    String(row.month_2_status || '').toUpperCase() === 'UNPAID'
      ? Number(row.month_2_amount || 0)
      : 0;

  const month3 =
    String(row.month_3_status || '').toUpperCase() === 'UNPAID'
      ? Number(row.month_3_amount || 0)
      : 0;

  return month1 + month2 + month3;
};

export default function AdminBillingTrackingPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingCompanyId, setSavingCompanyId] = useState(null);

  const [historyCompanyId, setHistoryCompanyId] = useState(null);
  const [historyCompanyName, setHistoryCompanyName] = useState('');
  const [historyRows, setHistoryRows] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const rowsRef = useRef([]);
  const autoSaveBusyRef = useRef(false);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const loadRows = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/bill-tracking');

      setRows((prev) => {
        const dirtyMap = new Map(
          prev
            .filter((row) => row._dirty)
            .map((row) => [row.company_id, row])
          );

          const merged = (response.data || []).map((row) => {
            const dirtyRow = dirtyMap.get(row.company_id);

            if (dirtyRow) {
              return {
                ...row,
                month_1_status: dirtyRow.month_1_status,
                month_1_amount: dirtyRow.month_1_amount,
                month_2_status: dirtyRow.month_2_status,
                month_2_amount: dirtyRow.month_2_amount,
                month_3_status: dirtyRow.month_3_status,
                month_3_amount: dirtyRow.month_3_amount,
                total_invoice_amount: dirtyRow.total_invoice_amount,
                total_amount_due: calculateTotalAmountDue(dirtyRow),
                _dirty: true,
              };
            }

            return {
              ...row,
              total_amount_due: calculateTotalAmountDue(row),
              _dirty: false,
            };
          });

          return merged.sort((a, b) =>
            (a.company_name || '').localeCompare(b.company_name || '')
          );
        });
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
    const interval = setInterval(() => {
      loadRows();
    }, 30000);

    return () => clearInterval(interval);
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
        row.suspension_comment,
        row.suspension_date,
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
      prev.map((row) => {
        if (row.company_id !== companyId) {
          return row;
        }

        const updatedRow = {
          ...row,
          [field]: value,
        };

        return {
          ...updatedRow,
          total_amount_due: calculateTotalAmountDue(updatedRow),
          _dirty: true,
        };
      })
    );
  };

  const saveRow = async (row, showToast = true) => {
    const payload = {
      company_id: row.company_id,
      company_status: row.company_status,
      suspension_comment: row.suspension_comment || null,
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
        item.company_id === row.company_id
          ? {
              ...item,
              company_status: row.company_status,
              suspension_comment: row.suspension_comment || null,
              suspension_date:
              row.company_status === 'SUSPENDED'
                ? item.suspension_date || new Date().toISOString()
                : null,
              month_1_status: row.month_1_status,
              month_1_amount: row.month_1_amount,
              month_2_status: row.month_2_status,
              month_2_amount: row.month_2_amount,
              month_3_status: row.month_3_status,
              month_3_amount: row.month_3_amount,
              total_invoice_amount: Number(row.total_invoice_amount || 0),
              total_amount_due: calculateTotalAmountDue(row),
              _dirty: false,
            }
         : item
       )
    );

    if (showToast) {
      toast.success(`Saved ${row.company_name}.`);
    }
  };

  const handleSaveRow = async (row) => {
    try {
      setSavingCompanyId(row.company_id);
      await saveRow(row, true);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save bill tracking row.');
    } finally {
      setSavingCompanyId(null);
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      if (autoSaveBusyRef.current) return;

      const dirtyRows = rowsRef.current.filter((row) => row._dirty);
      if (!dirtyRows.length) return;

      autoSaveBusyRef.current = true;

      try {
        for (const row of dirtyRows) {
          await saveRow(row, false);
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        autoSaveBusyRef.current = false;
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

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
              className="h-10 px-3 rounded border border-slate-300 bg-white text-slate-900"
            />

            <button
              type="button"
              onClick={loadRows}
              className="h-10 px-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-900"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card-technical p-6 text-slate-600">
            Loading bill tracking...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="card-technical p-6 text-slate-600">
            No companies found.
          </div>
        ) : (
          <div className="card-technical">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-left px-4 py-3">Status</th> 
                    <th className="text-left px-4 py-3">Month 1</th>
                    <th className="text-left px-4 py-3">Month 2</th>
                    <th className="text-left px-4 py-3">Month 3</th>
                    <th className="text-left px-4 py-3">Amount Due</th>
                    <th className="text-left px-4 py-3">Suspension Notes</th>
                    <th className="text-left px-4 py-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedRows.map((row, index) => (
                    <tr
                      key={row.company_id}
                      className={`border-b border-slate-200 hover:bg-slate-50 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {row.company_name}
                      </td>

                      <td className="px-4 py-3">
                        <select
                          value={row.company_status || 'ACTIVE'}
                          onChange={(e) =>
                            updateRowField(row.company_id, 'company_status', e.target.value)
                          }
                          className={`w-full rounded-md px-2 py-1 text-sm ${getCompanyStatusClass(
                            row.company_status
                          )}`}
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="SUSPENDED">Suspended</option>
                          <option value="DELETED">Deleted</option>
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-500 mb-1">
                          {row.month_1_name || 'Month 1'}
                        </div>
                        <div className="space-y-2">
                          <select
                            value={row.month_1_status || ''}
                            onChange={(e) =>
                              updateRowField(
                                row.company_id,
                                'month_1_status',
                                e.target.value
                              )
                            }
                            className={`w-full rounded-md px-2 py-1 text-sm ${getMonthStatusClass(
                              row.month_1_status
                            )}`}
                          >
                            <option value="PAID">Paid</option>
                            <option value="UNPAID">Unpaid</option>
                            <option value="SUSPENDED">Suspended</option>
                          </select>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.month_1_amount ?? ''}
                            onChange={(e) =>
                              updateRowField(
                                row.company_id,
                                'month_1_amount',
                                e.target.value
                              )
                            }
                            placeholder="Amount"
                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-500 mb-1">
                          {row.month_2_name || 'Month 2'}
                        </div>
                        <div className="space-y-2">
                          <select
                            value={row.month_2_status || ''}
                            onChange={(e) =>
                              updateRowField(
                                row.company_id,
                                'month_2_status',
                                e.target.value
                              )
                            }
                            className={`w-full rounded-md px-2 py-1 text-sm ${getMonthStatusClass(
                              row.month_2_status
                            )}`}
                          >
                            <option value="PAID">Paid</option>
                            <option value="UNPAID">Unpaid</option>
                            <option value="SUSPENDED">Suspended</option>
                          </select>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.month_2_amount ?? ''}
                            onChange={(e) =>
                              updateRowField(
                                row.company_id,
                                'month_2_amount',
                                e.target.value
                              )
                            }
                            placeholder="Amount"
                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-500 mb-1">
                          {row.month_3_name || 'Month 3'}
                        </div>
                        <div className="space-y-2">
                          <select
                            value={row.month_3_status || ''}
                            onChange={(e) =>
                              updateRowField(
                                row.company_id,
                                'month_3_status',
                                e.target.value
                              )
                            }
                            className={`w-full rounded-md px-2 py-1 text-sm ${getMonthStatusClass(
                              row.month_3_status
                            )}`}
                          >
                            <option value="PAID">Paid</option>
                            <option value="UNPAID">Unpaid</option>
                            <option value="SUSPENDED">Suspended</option>
                          </select>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.month_3_amount ?? ''}
                            onChange={(e) =>
                              updateRowField(
                                row.company_id,
                                'month_3_amount',
                                e.target.value
                              )
                            }
                            placeholder="Amount"
                            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 font-semibold text-right">
                        R {Number(row.total_amount_due || 0).toFixed(2)}
                      </td>

                      <td className="px-4 py-3">
                        {String(row.company_status || '').toUpperCase() === 'SUSPENDED' ? (
                          <div className="space-y-2 min-w-[220px]">
                            <textarea
                              value={row.suspension_comment || ''}
                              onChange={(e) =>
                                updateRowField(row.company_id, 'suspension_comment', e.target.value)
                              }
                              placeholder="Enter suspension reason..."
                              rows={3}
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 resize-y"
                            />
                            <div className="text-xs text-slate-500">
                              Suspended on:{' '}
                              {row.suspension_date
                                ? new Date(row.suspension_date).toLocaleDateString()
                                : 'Pending save'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-2 min-w-[110px]">
                          <button
                            type="button"
                            onClick={() => handleSaveRow(row)}
                            disabled={savingCompanyId === row.company_id}
                            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {savingCompanyId === row.company_id ? 'Saving...' : 'Save'}
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const response = await api.get(
                                  `/admin/bill-tracking/${row.company_id}/statement-pdf`,
                                  { responseType: 'blob' }
                                );

                                const url = window.URL.createObjectURL(new Blob([response.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute(
                                  'download',
                                  `statement_${(row.company_name || 'company').replace(/\s+/g, '_')}.pdf`
                                );
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                                window.URL.revokeObjectURL(url);
                              } catch (error) {
                                toast.error(
                                  error?.response?.data?.detail || 'Failed to generate statement PDF.'
                                );
                              }
                            }}
                            className="px-3 py-2 rounded bg-slate-700 text-white hover:bg-slate-800"
                          >
                            Statement
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                setLoadingHistory(true);
                                const response = await api.get(
                                  `/admin/bill-tracking/${row.company_id}/history`
                                );
                                  setHistoryCompanyId(row.company_id);
                                  setHistoryCompanyName(row.company_name || 'Company');
                                  setHistoryRows(response.data?.months || []);
                                } catch (error) {
                                  toast.error(
                                    error?.response?.data?.detail || 'Failed to load payment history.'
                                  );
                                } finally {
                                  setLoadingHistory(false);
                                }
                              }}
                              className="px-3 py-2 rounded bg-slate-200 text-slate-900 hover:bg-slate-300"
                            >
                              History
                            </button>
                          </div>
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
                className="px-3 py-1 rounded bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-50"
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
                className="px-3 py-1 rounded bg-slate-100 text-slate-900 hover:bg-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            {historyCompanyId && (
              <div className="border-t border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium uppercase tracking-wide text-slate-600">
                    12-Month History — {historyCompanyName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryCompanyId(null);
                      setHistoryCompanyName('');
                      setHistoryRows([]);
                    }}
                    className="px-3 py-1 rounded bg-slate-100 text-slate-900 hover:bg-slate-200"
                  >
                    Close
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="text-sm text-slate-600">Loading history...</div>
                ) : historyRows.length === 0 ? (
                  <div className="text-sm text-slate-600">No history available.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-4 py-3">Month</th>
                          <th className="text-left px-4 py-3">Status</th>
                          <th className="text-right px-4 py-3">Amount</th>
                          <th className="text-left px-4 py-3">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRows.map((item, idx) => (
                          <tr
                            key={`${item.month_name}-${idx}`}
                            className="border-t border-slate-200"
                          >
                            <td className="px-4 py-3">{item.month_name}</td>
                            <td className="px-4 py-3">{item.status}</td>
                            <td className="px-4 py-3 text-right">
                              R {Number(item.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              {item.updated_at
                                ? new Date(item.updated_at).toLocaleDateString()
                                : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </PlatformAdminLayout>
  );
}
