import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { toast } from 'sonner';
import { saveCompanyCurrency } from '../lib/currency';

const FALLBACK_CURRENCY_CODES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN',
  'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL',
  'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY',
  'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP',
  'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR',
  'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF',
  'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR',
  'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON',
  'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP',
  'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT',
  'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU',
  'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER',
  'ZAR', 'ZMW', 'ZWL',
];

function getSupportedCurrencyCodes() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      return Intl.supportedValuesOf('currency');
    } catch {
      return FALLBACK_CURRENCY_CODES;
    }
  }

  return FALLBACK_CURRENCY_CODES;
}

function getCurrencyName(code) {
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });
    return displayNames.of(code) || code;
  } catch {
    return code;
  }
}

function getCurrencySymbol(code) {
  try {
    const parts = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);

    return parts.find((part) => part.type === 'currency')?.value || code;
  } catch {
    return code;
  }
}

export default function CompanyDetailsPage() {
  const logoRef = useRef(null);

  const [formData, setFormData] = useState({
    company_name: '',
    registration_number: '',
    vat_number: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_branch_code: '',
    quote_footer: '',
    invoice_footer: '',
    statement_footer: '',
    currency_code: 'ZAR',
    currency_symbol: 'R',
    currency_name: 'South African Rand',
    logo_data_url: '',

    production_work_start: '08:00',
    production_work_end: '17:00',
    production_working_hours: '9',

    production_tea_1_start: '10:00',
    production_tea_1_end: '10:15',

    production_lunch_start: '13:00',
    production_lunch_end: '13:30',

    production_tea_2_start: '15:00',
    production_tea_2_end: '15:15',
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  useEffect(() => {
    api.get('/company-details')
      .then((res) => {
        const data = res.data || {};
        setFormData((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.keys(prev).map((key) => [key, data[key] || ''])
          ),
        }));
      })
      .catch(() => toast.error('Failed to load company details'));
  }, []);

  const update = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value || '' }));
  };

  const timeToMinutes = (value) => {
    if (!value || !String(value).includes(':')) return null;

    const [hours, minutes] = String(value).split(':').map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    return hours * 60 + minutes;
  };

  const calculateWorkingHours = () => {
    const workStart = timeToMinutes(formData.production_work_start);
    const workEnd = timeToMinutes(formData.production_work_end);

    if (workStart === null || workEnd === null || workEnd <= workStart) {
      return 0;
    }

    let totalMinutes = workEnd - workStart;

    [
      ['production_tea_1_start', 'production_tea_1_end'],
      ['production_lunch_start', 'production_lunch_end'],
      ['production_tea_2_start', 'production_tea_2_end'],
    ].forEach(([startKey, endKey]) => {
      const breakStart = timeToMinutes(formData[startKey]);
      const breakEnd = timeToMinutes(formData[endKey]);

      if (breakStart !== null && breakEnd !== null && breakEnd > breakStart) {
        totalMinutes -= breakEnd - breakStart;
      }
    });

    return Math.max(totalMinutes, 0) / 60;
  };

  const calculatedWorkingHours = calculateWorkingHours();

  const uploadLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      toast.error('Logo must be PNG');
      return;
    }

    if (file.size > 100 * 1024) {
      toast.error('Logo must be 100KB or smaller');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => update('logo_data_url', String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!password) {
      toast.error('Enter your login password before saving');
      return;
    }

    try {
      await api.post('/company-details', {
        ...formData,
        production_working_hours: calculatedWorkingHours,
        verification_password: password,
      });

      saveCompanyCurrency({
        currency_code: formData.currency_code,
        currency_symbol: formData.currency_symbol,
        currency_name: formData.currency_name,
      });

      setPassword('');
      toast.success('Company details saved');

      const reload = await api.get('/company-details');
      const data = reload.data || {};
      saveCompanyCurrency(data);
      setFormData((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.keys(prev).map((key) => [key, data[key] || ''])
        ),
      }));

      window.setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Save failed');
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/company-details/template-pdf', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'company-details-template-preview.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download template PDF');
    }
  };

  const inputClass = "w-full rounded border px-3 py-2";

  const currencyOptions = useMemo(() => {
    return getSupportedCurrencyCodes()
      .map((code) => {
        const symbol = getCurrencySymbol(code);
        const name = getCurrencyName(code);

        return {
          code,
          symbol,
          name,
          label: `${symbol} — ${name} (${code})`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const selectedCurrencyLabel =
    currencyOptions.find((item) => item.code === formData.currency_code)?.label ||
    `${formData.currency_symbol || 'R'} — ${formData.currency_name || 'South African Rand'} (${formData.currency_code || 'ZAR'})`;

  const filteredCurrencyOptions = useMemo(() => {
    const term = currencySearch.trim().toLowerCase();

    if (!term) return currencyOptions;

    return currencyOptions.filter((item) =>
      item.code.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      item.symbol.toLowerCase().includes(term) ||
      item.label.toLowerCase().includes(term)
    );
  }, [currencyOptions, currencySearch]);

  return (
    <Layout>
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-4xl font-black">Company Details</h1>
          <p className="text-slate-600 mt-2">
            Configure company information for quotes, invoices, statements and reports.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-2">Company Logo</h2>
            <p className="text-sm text-slate-500 mb-3">
              Logo should be a full colour PNG logo with a transparent background. Maximum file size: 100KB.
            </p>

            <input ref={logoRef} type="file" accept="image/png" className="hidden" onChange={uploadLogo} />

            <button type="button" className="rounded bg-slate-100 px-4 py-2 border" onClick={() => logoRef.current?.click()}>
              Upload PNG Logo
            </button>

            {formData.logo_data_url && (
              <div className="mt-4 rounded border p-4 w-fit">
                <img src={formData.logo_data_url} alt="Company Logo" style={{ maxHeight: 90, maxWidth: 220, objectFit: 'contain' }} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['company_name', 'Company Name'],
              ['registration_number', 'Registration Number'],
              ['vat_number', 'VAT Number'],
              ['phone', 'Phone'],
              ['email', 'Email'],
              ['website', 'Website'],
              ['bank_name', 'Bank Name'],
              ['bank_account_name', 'Account Name'],
              ['bank_account_number', 'Account Number'],
              ['bank_branch_code', 'Branch Code'],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="block font-medium mb-1">{label}</label>
                <input className={inputClass} value={formData[field] || ''} onChange={(e) => update(field, e.target.value)} />
              </div>
            ))}
          </div>

          <div>
            <label className="block font-medium mb-1">Company Address</label>
            <textarea className={inputClass} value={formData.address || ''} onChange={(e) => update('address', e.target.value)} />
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 space-y-4">
            <div>
              <h2 className="text-xl font-bold">Production Working Hours</h2>
              <p className="mt-1 text-sm text-slate-500">
                Set the normal working day and break times used for production planning.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-medium mb-1">Work Start</label>
                <input
                  type="time"
                  className={inputClass}
                  value={formData.production_work_start || '08:00'}
                  onChange={(e) => update('production_work_start', e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Work End</label>
                <input
                  type="time"
                  className={inputClass}
                  value={formData.production_work_end || '17:00'}
                  onChange={(e) => update('production_work_end', e.target.value)}
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Working Hours</label>
                <div className="w-full rounded border bg-white px-3 py-2 font-semibold text-slate-800">
                  {calculatedWorkingHours.toFixed(2)} hours
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Auto calculated from work start/end minus tea and lunch breaks.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded border bg-white p-3">
                <h3 className="font-semibold mb-3">Tea Break 1</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start</label>
                    <input
                      type="time"
                      className={inputClass}
                      value={formData.production_tea_1_start || '10:00'}
                      onChange={(e) => update('production_tea_1_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End</label>
                    <input
                      type="time"
                      className={inputClass}
                      value={formData.production_tea_1_end || '10:15'}
                      onChange={(e) => update('production_tea_1_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded border bg-white p-3">
                <h3 className="font-semibold mb-3">Lunch Break</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start</label>
                    <input
                      type="time"
                      className={inputClass}
                      value={formData.production_lunch_start || '13:00'}
                      onChange={(e) => update('production_lunch_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End</label>
                    <input
                      type="time"
                      className={inputClass}
                      value={formData.production_lunch_end || '13:30'}
                      onChange={(e) => update('production_lunch_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded border bg-white p-3">
                <h3 className="font-semibold mb-3">Tea Break 2</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start</label>
                    <input
                      type="time"
                      className={inputClass}
                      value={formData.production_tea_2_start || '15:00'}
                      onChange={(e) => update('production_tea_2_start', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End</label>
                    <input
                      type="time"
                      className={inputClass}
                      value={formData.production_tea_2_end || '15:15'}
                      onChange={(e) => update('production_tea_2_end', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>


          <div className="rounded-xl border bg-slate-50 p-4">
            <h2 className="text-xl font-bold mb-2">Currency</h2>
            <p className="text-sm text-slate-600 mb-3">
              Select the currency symbol and wording used across materials, labour, machines, installation, recipes, estimations, quotes and invoices. This does not convert prices or apply exchange rates.
            </p>

            <label className="block font-medium mb-1">Search Currency</label>
            <input
              className={inputClass}
              value={currencySearch}
              onChange={(e) => setCurrencySearch(e.target.value)}
              placeholder="Type country, currency name, symbol or code e.g. dollar, USD, pound, euro"
            />

            <label className="mt-3 block font-medium mb-1">Company Currency</label>
            <select
              className={inputClass}
              value={formData.currency_code || 'ZAR'}
              onChange={(e) => {
                const selected = currencyOptions.find((item) => item.code === e.target.value);

                setFormData((prev) => ({
                  ...prev,
                  currency_code: selected?.code || 'ZAR',
                  currency_symbol: selected?.symbol || 'R',
                  currency_name: selected?.name || 'South African Rand',
                }));

                setCurrencySearch('');
              }}
            >
              {filteredCurrencyOptions.length === 0 ? (
                <option value={formData.currency_code || 'ZAR'}>
                  No matching currency found
                </option>
              ) : (
                filteredCurrencyOptions.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))
              )}
            </select>

            <div className="mt-3 rounded border bg-white p-3 text-sm text-slate-700">
              Selected: <strong>{selectedCurrencyLabel}</strong>
              <div className="mt-1 text-slate-500">
                Example display: <strong>{formData.currency_symbol || 'R'} 1,000.00</strong>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Quote Footer</label>
            <textarea className={inputClass} value={formData.quote_footer || ''} onChange={(e) => update('quote_footer', e.target.value)} />
          </div>

          <div>
            <label className="block font-medium mb-1">Invoice Footer</label>
            <textarea className={inputClass} value={formData.invoice_footer || ''} onChange={(e) => update('invoice_footer', e.target.value)} />
          </div>

          <div>
            <label className="block font-medium mb-1">Statement Footer</label>
            <textarea className={inputClass} value={formData.statement_footer || ''} onChange={(e) => update('statement_footer', e.target.value)} />
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 p-4">
            <label className="block font-medium mb-1">Login Password Verification</label>
            <p className="text-sm text-amber-800 mb-2">Enter your login password before saving.</p>

            <div className="flex gap-2">
              <input
                className={inputClass}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your login password"
                autoComplete="new-password"
                name="company-details-verification"
              />

              <button type="button" className="rounded border px-4" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-500">
            First save the company details, then click Download PDF Template.
          </p>

          <div className="flex gap-3">
            <button type="button" className="rounded bg-blue-600 text-white px-4 py-2" onClick={(e) => { e.preventDefault(); save(); }}>
              Save Company Details
            </button>

            <button type="button" className="rounded border px-4 py-2" onClick={(e) => { e.preventDefault(); downloadTemplate(); }}>
              Download PDF Template
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
