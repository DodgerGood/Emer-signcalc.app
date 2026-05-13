import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { Upload, FileText, Eye, EyeOff } from 'lucide-react';

const allowedRoles = ['MD_ADMIN', 'CEO', 'MANAGER'];

const emptyForm = {
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
};

export default function CompanyDetailsPage() {
  const { user } = useAuth();
  const logoInputRef = useRef(null);

  const [formData, setFormData] = useState(emptyForm);
  const [verificationPassword, setVerificationPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const canAccess = allowedRoles.includes(user?.role);

  useEffect(() => {
    if (!canAccess) return;

    api.get('/company-details')
      .then((response) => {
        const data = response.data || {};
        setFormData({
          ...emptyForm,
          ...Object.fromEntries(
            Object.keys(emptyForm).map((key) => [key, data[key] || ''])
          ),
        });
      })
      .catch(() => {
        toast.error('Failed to load company details');
      });
  }, [canAccess]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value || '' }));
  };

  const uploadLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      toast.error('Logo must be a PNG file');
      event.target.value = '';
      return;
    }

    if (file.size > 100 * 1024) {
      toast.error('Logo must be 100KB or smaller');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField('logo_data_url', String(reader.result || ''));
      toast.success('Logo uploaded');
    };
    reader.readAsDataURL(file);
  };

  const saveDetails = async () => {
    if (!verificationPassword) {
      toast.error('Enter your login password before saving');
      return;
    }

    try {
      setSaving(true);
      await api.post('/company-details', {
        ...formData,
        verification_password: verificationPassword,
      });
      setVerificationPassword('');
      toast.success('Company details saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/company-details/template-pdf', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
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

  if (!canAccess) {
    return (
      <Layout>
        <div className="text-red-600 font-semibold">
          You do not have permission to access this page.
        </div>
      </Layout>
    );
  }

  const fields = [
    ['company_name', 'Company Name', 'Official registered company name used on quotes, invoices and statements.'],
    ['registration_number', 'Registration Number', 'Official business or company registration number.'],
    ['vat_number', 'VAT Number', 'VAT number displayed on invoices and statements.'],
    ['phone', 'Phone', 'Main company contact number.'],
    ['email', 'Email', 'Main company email address.'],
    ['website', 'Website', 'Company website shown on customer-facing documents.'],
    ['bank_name', 'Bank Name', 'Bank used for customer payments.'],
    ['bank_account_name', 'Account Name', 'Bank account holder name.'],
    ['bank_account_number', 'Account Number', 'Bank account number for EFT payments.'],
    ['bank_branch_code', 'Branch Code', 'Bank branch code for EFT payments.'],
  ];

  return (
    <Layout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Company Details</h1>
          <p className="text-slate-600 mt-2">
            Configure company information for quotes, invoices, statements and reports.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 space-y-6 shadow-sm">
          <h2 className="text-xl font-bold">Company Information</h2>

          <div className="space-y-2">
            <Label>Company Logo</Label>
            <p className="text-xs text-slate-500">
              Logo should be a full colour PNG logo with a transparent background. Maximum file size: 100KB.
            </p>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={uploadLogo}
            />

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                <Upload size={18} className="mr-2" />
                Upload PNG Logo
              </Button>

              {formData.logo_data_url && (
                <Button type="button" variant="outline" onClick={() => updateField('logo_data_url', '')}>
                  Remove Logo
                </Button>
              )}
            </div>

            {formData.logo_data_url && (
              <div className="rounded-lg border bg-white p-4 w-fit">
                <img
                  src={formData.logo_data_url}
                  alt="Company Logo"
                  className="max-h-24 max-w-[220px] object-contain"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map(([field, label, helper]) => (
              <div key={field} className="space-y-2">
                <Label>{label}</Label>
                <p className="text-xs text-slate-500">{helper}</p>
                <Input
                  value={formData[field] || ''}
                  onChange={(e) => updateField(field, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Company Address</Label>
            <p className="text-xs text-slate-500">
              Physical or billing address shown on quotes and invoices.
            </p>
            <Textarea
              value={formData.address || ''}
              onChange={(e) => updateField('address', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Quote Footer</Label>
            <Textarea value={formData.quote_footer || ''} onChange={(e) => updateField('quote_footer', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Invoice Footer</Label>
            <Textarea value={formData.invoice_footer || ''} onChange={(e) => updateField('invoice_footer', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Statement Footer</Label>
            <Textarea value={formData.statement_footer || ''} onChange={(e) => updateField('statement_footer', e.target.value)} />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
            <Label>Login Password Verification</Label>
            <p className="text-xs text-amber-800">
              Enter your own login password before saving.
            </p>

            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={verificationPassword}
                onChange={(e) => setVerificationPassword(e.target.value)}
                placeholder="Enter your login password"
                className="pr-10"
              />

              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            First save the company details, then click Download PDF Template to preview how quotes, invoices and statements will look with the saved information.
          </p>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Button onClick={saveDetails} disabled={saving} className="bg-[#2563EB] hover:bg-[#1d4ed8]">
              {saving ? 'Saving...' : 'Save Company Details'}
            </Button>

            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <FileText size={18} className="mr-2" />
              Download PDF Template
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
