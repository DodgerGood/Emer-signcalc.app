import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminSeatManagementPage() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [billingRecord, setBillingRecord] = useState(null);
  const [billingEmail, setBillingEmail] = useState('');
  const [billingStartDate, setBillingStartDate] = useState('');
  const [seatPrices, setSeatPrices] = useState({});
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billingSearch, setBillingSearch] = useState('');

const loadCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      const response = await api.get('/admin/companies');
      const activeCompanies = (response.data || []).filter(
        (company) => (company.status || '').toUpperCase() !== 'DELETED'
      );
      setCompanies(activeCompanies);

      setSelectedCompanyId((prev) =>
        !prev && activeCompanies.length > 0 ? activeCompanies[0].company_id : prev
      );
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load companies.');
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  const loadBillingRecord = async (companyId) => {
    if (!companyId) return;

    try {
      setLoadingBilling(true);
      const response = await api.get(`/admin/billing/${companyId}`);
      const record = response.data;

      setBillingRecord(record);
      setBillingEmail(record.billing_email || '');
      setBillingStartDate(record.billing_start_date || '');

      const nextSeatPrices = {};
      (record.seat_lines || []).forEach((line) => {
        nextSeatPrices[line.user_id] = String(line.seat_price_ex_vat ?? 0);
      });
      setSeatPrices(nextSeatPrices);
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to load billing record.');
    } finally {
      setLoadingBilling(false);
    }
  };

useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadBillingRecord(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const filteredSeatLines = useMemo(() => {
    const seatLines = billingRecord?.seat_lines || [];
    const searchValue = billingSearch.trim().toLowerCase();

    if (!searchValue) return seatLines;

    return seatLines.filter((line) =>
      [line.full_name, line.email, line.role, line.user_id]
        .join(' ')
        .toLowerCase()
        .includes(searchValue)
    );
  }, [billingRecord, billingSearch]);

  const calculatedTotals = useMemo(() => {
    const subtotal = (billingRecord?.seat_lines || []).reduce((sum, line) => {
      const raw = seatPrices[line.user_id];
      const parsed = raw === '' || raw === undefined ? 0 : Number(raw);
      return sum + (Number.isNaN(parsed) ? 0 : parsed);
    }, 0);

    const roundedSubtotal = Math.round(subtotal * 100) / 100;
    const vatAmount = Math.round(roundedSubtotal * 0.15 * 100) / 100;
    const totalInclVat = Math.round((roundedSubtotal + vatAmount) * 100) / 100;

    return {
      subtotal: roundedSubtotal,
      vatAmount,
      totalInclVat,
    };
  }, [billingRecord, seatPrices]);

  const handlePriceChange = (userId, value) => {
    if (value === '') {
      setSeatPrices((prev) => ({ ...prev, [userId]: '' }));
      return;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) return;

    setSeatPrices((prev) => ({ ...prev, [userId]: value }));
  };

  const handleSaveBilling = async () => {
    if (!selectedCompanyId) {
      toast.error('Please select a company.');
      return;
    }

    for (const line of billingRecord?.seat_lines || []) {
      const raw = seatPrices[line.user_id];
      const parsed = raw === '' || raw === undefined ? 0 : Number(raw);

      if (Number.isNaN(parsed) || parsed < 0) {
        toast.error(`Invalid seat price for ${line.full_name || line.email || line.user_id}.`);
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        company_id: selectedCompanyId,
        billing_email: billingEmail || null,
        billing_start_date: billingStartDate || null,
        seat_lines: (billingRecord?.seat_lines || []).map((line) => ({
          user_id: line.user_id,
          seat_price_ex_vat: Number(seatPrices[line.user_id] || 0),
        })),
      };

      const response = await api.post('/admin/billing/upsert', payload);
      const record = response.data;

      setBillingRecord(record);
      setBillingEmail(record.billing_email || '');
      setBillingStartDate(record.billing_start_date || '');

      const nextSeatPrices = {};
      (record.seat_lines || []).forEach((line) => {
        nextSeatPrices[line.user_id] = String(line.seat_price_ex_vat ?? 0);
      });
      setSeatPrices(nextSeatPrices);

      toast.success('Billing record saved successfully.');
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Failed to save billing record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Bill Invoicing
          </h1>
          <p className="text-slate-600 mt-2">
            Invoice generation, seat pricing, VAT, and billing setup
          </p>
        </div>

        <div className="card-technical p-6">
          <div className="flex items-center gap-2 flex-wrap">

            <input
              type="text"
              value={billingSearch}
              onChange={(e) => setBillingSearch(e.target.value)}
              placeholder="Search company name..."
              className="h-10 px-3 rounded border border-slate-300 bg-white text-slate-900 text-sm"
            />

            <button
              type="button"
              onClick={() => {
                const searchValue = billingSearch.trim().toLowerCase();
                const match = companies.find((company) =>
                  (company.company_name || '').toLowerCase().includes(searchValue)
                );

                if (!match) {
                  toast.error('No matching company found.');
                  return;
                }

                setSelectedCompanyId(match.company_id);
              }}
              className="h-10 px-4 rounded bg-[#2563EB] text-white text-sm"
            >
              Load Company
            </button>

            <button
              type="button"
              onClick={() => {
                loadCompanies();
                if (selectedCompanyId) loadBillingRecord(selectedCompanyId);
              }}
              className="h-10 px-4 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm"
            >
              Refresh
            </button>
          </div>
        </div>

        {loadingBilling || loadingCompanies ? (
          <div className="card-technical p-6 text-slate-600">Loading billing data...</div>
        ) : !billingRecord ? (
          <div className="card-technical p-6 text-slate-600">No billing data available.</div>
        ) : (
          <>
            <div className="card-technical p-6">
              <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-4">
                Billing Setup
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={billingRecord.company_name || ''}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-600 mb-1">
                    Billing Start Date
                  </label>
                  <input
                    type="date"
                    value={billingStartDate}
                    onChange={(e) => setBillingStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="card-technical">
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                  Seat Pricing
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="text-left px-4 py-3">Full Name</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3">Role</th>
                      <th className="text-left px-4 py-3">Seat Price (Excl. VAT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSeatLines.map((line) => (
                      <tr key={line.user_id} className="border-t border-slate-200">
                        <td className="px-4 py-3">{line.full_name || '—'}</td>
                        <td className="px-4 py-3">{line.email || '—'}</td>
                        <td className="px-4 py-3">{line.role || '—'}</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={seatPrices[line.user_id] ?? '0'}
                            onChange={(e) => handlePriceChange(line.user_id, e.target.value)}
                            className="w-full max-w-[180px] px-3 py-2 border border-slate-300 rounded text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card-technical p-6">
              <h2 className="text-sm font-medium text-slate-600 uppercase tracking-wide mb-4">
                Billing Summary
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="text-sm uppercase tracking-wide text-slate-500">
                    Subtotal Excl. VAT
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    R {calculatedTotals.subtotal.toFixed(2)}
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="text-sm uppercase tracking-wide text-slate-500">
                    VAT 15%
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    R {calculatedTotals.vatAmount.toFixed(2)}
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="text-sm uppercase tracking-wide text-slate-500">
                    Total Incl. VAT
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    R {calculatedTotals.totalInclVat.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveBilling}
                  disabled={saving}
                  className="inline-flex justify-center px-4 py-2 bg-[#2563EB] text-white rounded text-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Billing'} 
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await api.get(
                        `/admin/billing/${selectedCompanyId}/invoice-pdf`,
                        { responseType: 'blob' }
                      );

                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `invoice_${billingRecord.company_name}.pdf`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (error) {
                      toast.error(error?.response?.data?.detail || 'Failed to generate PDF invoice.');
                    }
                  }}
                  className="inline-flex justify-center px-4 py-2 bg-slate-700 text-white rounded text-sm"
                >
                  Generate PDF
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </PlatformAdminLayout>
  );
}
