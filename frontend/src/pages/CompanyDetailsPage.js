import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';
import { Upload, FileText, Eye, EyeOff } from 'lucide-react';

const allowedRoles = ['MD_ADMIN', 'CEO', 'MANAGER'];

const emptyCompanyDetails = {
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [verificationPassword, setVerificationPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(emptyCompanyDetails);

  useEffect(() => {
    if (!allowedRoles.includes(user?.role)) {
      setLoading(false);
      return;
    }

    loadCompanyDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const loadCompanyDetails = async () => {
    try {
      const response = await api.get('/company-details');
      const data = response.data || {};

      setFormData({
        company_name: data.company_name || '',
        registration_number: data.registration_number || '',
        vat_number: data.vat_number || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        address: data.address || '',
        bank_name: data.bank_name || '',
        bank_account_name: data.bank_account_name || '',
        bank_account_number: data.bank_account_number || '',
        bank_branch_code: data.bank_branch_code || '',
        quote_footer: data.quote_footer || '',
        invoice_footer: data.invoice_footer || '',
        statement_footer: data.statement_footer || '',
        logo_data_url: data.logo_data_url || '',
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = (event) => {
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
      handleChange('logo_data_url', reader.result || '');
      toast.success('Logo loaded');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!verificationPassword) {
      toast.error('Enter your login password to save company details');
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
      await loadCompanyDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const downloadPdfTemplate = async () => {
    try {
      const response = await api.get('/company-details/template-pdf', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'company-details-template-preview.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      let detail = 'Failed to download template PDF';

      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const json = JSON.parse(text);
          detail = json.detail || detail;
        } catch {
          detail = 'Failed to download template PDF';
        }
      } else {
        detail = error.response?.data?.detail || error.message || detail;
      }

      toast.error(detail);
    }
  };

  if (!allowedRoles.includes(user?.role)) {
    return (
      <Layout>
        <div className="text-red-600 font-semibold">
          You do not have permission to access this page.
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="p-8">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Company Details</h1>
          <p className="text-slate-600 mt-2">
            Configure company information for quotes, invoices, statements and reports.
          </p>
        </div>

        <Card className="card-technical">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
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
                onChange={handleLogoUpload}
              />

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()}>
                  <Upload size={18} className="mr-2" />
                  Upload PNG Logo
                </Button>

                {formData.logo_data_url && (
                  <Button type="button" variant="outline" onClick={() => handleChange('logo_data_url', '')}>
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
              {[
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
              ].map(([field, label, helper]) => (
                <div key={field} className="space-y-2">
                  <Label>{label}</Label>
                  <p className="text-xs text-slate-500">{helper}</p>
                  <Input
                    value={formData[field] || ''}
                    onChange={(e) => handleChange(field, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Company Address</Label>
              <p className="text-xs text-slate-500">
                Physical or billing address shown on quotes and invoices.
              </p>
              <Textarea value={formData.address || ''} onChange={(e) => handleChange('address', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Quote Footer</Label>
              <p className="text-xs text-slate-500">Footer text shown at the bottom of all quotes.</p>
              <Textarea value={formData.quote_footer || ''} onChange={(e) => handleChange('quote_footer', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Invoice Footer</Label>
              <p className="text-xs text-slate-500">Footer text shown at the bottom of all invoices.</p>
              <Textarea value={formData.invoice_footer || ''} onChange={(e) => handleChange('invoice_footer', e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Statement Footer</Label>
              <p className="text-xs text-slate-500">Footer text shown at the bottom of all statements.</p>
              <Textarea value={formData.statement_footer || ''} onChange={(e) => handleChange('statement_footer', e.target.value)} />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2">
              <Label>Login Password Verification</Label>
              <p className="text-xs text-amber-800">
                Enter your own login password before saving. This protects company banking, logo and document settings.
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                First save the company details, then click Download PDF Template to preview how quotes, invoices and statements will look with the saved information.
              </p>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-[#2563EB] hover:bg-[#1d4ed8]"
                >
                  {saving ? 'Saving...' : 'Save Company Details'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadPdfTemplate}
                  className="border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  <FileText size={18} className="mr-2" />
                  Download PDF Template
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
