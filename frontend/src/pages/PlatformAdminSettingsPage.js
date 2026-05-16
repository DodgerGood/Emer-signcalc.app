import React, { useEffect, useState } from 'react';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import api from '../lib/api';
import { toast } from 'sonner';
import { Building2, Image as ImageIcon, Save } from 'lucide-react';

const emptySettings = {
  company_name: '',
  trading_name: '',
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
  logo_data_url: '',
  platform_logo_data_url: '',
};

export default function PlatformAdminSettingsPage() {
  const [settings, setSettings] = useState(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/platform-settings');
      setSettings({
        ...emptySettings,
        ...(response.data || {}),
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateField = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const readLogoFile = (file, field) => {
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Logo must be PNG or JPG');
      return;
    }

    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Logo must be 2MB or smaller');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      updateField(field, reader.result);
    };

    reader.onerror = () => {
      toast.error('Could not read logo file');
    };

    reader.readAsDataURL(file);
  };

  const saveSettings = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      await api.put('/admin/platform-settings', settings);
      toast.success('Platform settings saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save platform settings');
    } finally {
      setSaving(false);
    }
  };

  const logoPreview = settings.logo_data_url || settings.platform_logo_data_url;
  const platformLogoPreview = settings.platform_logo_data_url || settings.logo_data_url;

  return (
    <PlatformAdminLayout>
      <div className="max-w-5xl space-y-6 fade-in">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-black tracking-tight leading-none">
            <Building2 size={32} />
            Admin Settings
          </h1>
          <p className="mt-2 text-slate-600">
            Store the app owner company details used for platform branding, billing, quotes, invoices, and statements.
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl border bg-white p-8 text-slate-500">
            Loading platform settings...
          </div>
        ) : (
          <form onSubmit={saveSettings} className="space-y-6">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-black">Company Details</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Registered Company Name</Label>
                  <Input
                    value={settings.company_name}
                    onChange={(event) => updateField('company_name', event.target.value)}
                    placeholder="Company legal name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Trading Name / Platform Name</Label>
                  <Input
                    value={settings.trading_name}
                    onChange={(event) => updateField('trading_name', event.target.value)}
                    placeholder="Signomics / trading name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input
                    value={settings.registration_number}
                    onChange={(event) => updateField('registration_number', event.target.value)}
                    placeholder="Company registration number"
                  />
                </div>

                <div className="space-y-2">
                  <Label>VAT Number</Label>
                  <Input
                    value={settings.vat_number}
                    onChange={(event) => updateField('vat_number', event.target.value)}
                    placeholder="VAT number"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={settings.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    placeholder="+27..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={settings.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="support@example.com"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Website</Label>
                  <Input
                    value={settings.website}
                    onChange={(event) => updateField('website', event.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <Textarea
                    value={settings.address}
                    onChange={(event) => updateField('address', event.target.value)}
                    placeholder="Company address"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-xl font-black">Banking Details</h2>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={settings.bank_name}
                    onChange={(event) => updateField('bank_name', event.target.value)}
                    placeholder="Bank name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input
                    value={settings.bank_account_name}
                    onChange={(event) => updateField('bank_account_name', event.target.value)}
                    placeholder="Account holder"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={settings.bank_account_number}
                    onChange={(event) => updateField('bank_account_number', event.target.value)}
                    placeholder="Account number"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Branch Code</Label>
                  <Input
                    value={settings.bank_branch_code}
                    onChange={(event) => updateField('bank_branch_code', event.target.value)}
                    placeholder="Branch code"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
                <ImageIcon size={22} />
                Logos
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>Document Logo</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={(event) => readLogoFile(event.target.files?.[0], 'logo_data_url')}
                  />
                  <p className="text-xs text-slate-500">
                    Used later for platform owner quotes, invoices, and statements.
                  </p>

                  {logoPreview && (
                    <div className="rounded-lg border bg-slate-50 p-4">
                      <img
                        src={logoPreview}
                        alt="Document logo preview"
                        className="max-h-28 max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label>Platform Menu Logo</Label>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={(event) => readLogoFile(event.target.files?.[0], 'platform_logo_data_url')}
                  />
                  <p className="text-xs text-slate-500">
                    Used for the platform admin menu branding.
                  </p>

                  {platformLogoPreview && (
                    <div className="rounded-lg border bg-slate-900 p-4">
                      <img
                        src={platformLogoPreview}
                        alt="Platform logo preview"
                        className="max-h-28 max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pb-8">
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
              >
                <Save size={18} className="mr-2" />
                {saving ? 'Saving...' : 'Save Admin Settings'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PlatformAdminLayout>
  );
}
