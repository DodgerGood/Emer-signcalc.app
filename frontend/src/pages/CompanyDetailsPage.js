import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { toast } from 'sonner';

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
    logo_data_url: '',
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
        verification_password: password,
      });

      setPassword('');
      toast.success('Company details saved');
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
            <button type="button" className="rounded bg-blue-600 text-white px-4 py-2" onClick={save}>
              Save Company Details
            </button>

            <button type="button" className="rounded border px-4 py-2" onClick={downloadTemplate}>
              Download PDF Template
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
