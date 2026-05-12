import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { toast } from 'sonner';

export default function CompanyDetailsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    logo_url: '',
  });

  const allowedRoles = ['MD_ADMIN', 'CEO', 'MANAGER'];

  useEffect(() => {
    if (!allowedRoles.includes(user?.role)) {
      return;
    }

    loadCompanyDetails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompanyDetails = async () => {
    try {
      const response = await api.get('/company-details');
      if (response.data) {
        setFormData((prev) => ({
          ...prev,
          ...response.data,
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await api.post('/company-details', formData);

      toast.success('Company details saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
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
          <h1 className="text-4xl font-black tracking-tight">
            Company Details
          </h1>

          <p className="text-slate-600 mt-2">
            Configure company information for quotes, invoices, statements and reports.
          </p>
        </div>

        <Card className="card-technical">
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label>Company Name</Label>
              <p className="text-xs text-slate-500">
                Official registered company name used on quotes, invoices and statements.
              </p>
                <Input
                  value={formData.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Registration Number</Label>
              <p className="text-xs text-slate-500">
                Official business or company registration number.
              </p>
                <Input
                  value={formData.registration_number}
                  onChange={(e) => handleChange('registration_number', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>VAT Number</Label>
              <p className="text-xs text-slate-500">
                VAT number displayed on invoices and statements.
              </p>
                <Input
                  value={formData.vat_number}
                  onChange={(e) => handleChange('vat_number', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                />
              </div>

            </div>

            <div className="space-y-2">
              <Label>Company Address</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={formData.bank_name}
                  onChange={(e) => handleChange('bank_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input
                  value={formData.bank_account_name}
                  onChange={(e) => handleChange('bank_account_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  value={formData.bank_account_number}
                  onChange={(e) => handleChange('bank_account_number', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Branch Code</Label>
                <Input
                  value={formData.bank_branch_code}
                  onChange={(e) => handleChange('bank_branch_code', e.target.value)}
                />
              </div>

            </div>

            <div className="space-y-2">
              <Label>Quote Footer</Label>
              <Textarea
                value={formData.quote_footer}
                onChange={(e) => handleChange('quote_footer', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Invoice Footer</Label>
              <Textarea
                value={formData.invoice_footer}
                onChange={(e) => handleChange('invoice_footer', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Statement Footer</Label>
              <Textarea
                value={formData.statement_footer}
                onChange={(e) => handleChange('statement_footer', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Company Logo</Label>
              <p className="text-xs text-slate-500">
                Logo should be a full colour PNG logo with a transparent background.
              </p>

              <Input
                value={formData.logo_url || ''}
                onChange={(e) => handleChange('logo_url', e.target.value)}
                placeholder="Paste logo image URL here"
              />

              {formData.logo_url && (
                <div className="rounded-lg border bg-white p-4">
                  <img
                    src={formData.logo_url}
                    alt="Company Logo"
                    className="max-h-32 object-contain"
                  />
                </div>
              )}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#2563EB] hover:bg-[#1d4ed8]"
            >
              {saving ? 'Saving...' : 'Save Company Details'}
            </Button>

          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
