import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

export default function TravelSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ aa_rate_per_km: '', default_tolls: '' });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/travel-settings');
      setFormData({ aa_rate_per_km: response.data.aa_rate_per_km.toString(), default_tolls: response.data.default_tolls.toString() });
    } catch (error) {
      toast.error('Failed to load travel settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/travel-settings', {
        aa_rate_per_km: parseFloat(formData.aa_rate_per_km),
        default_tolls: parseFloat(formData.default_tolls)
      });
      toast.success('Travel settings updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-2xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">Travel Settings</h1>
          <p className="text-slate-600 mt-2">Configure default travel rates</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>
        ) : (
          <Card className="card-technical">
            <CardHeader><CardTitle>Travel Configuration</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="aa_rate">AA Rate per KM ($)</Label>
                  <Input id="aa_rate" type="number" step="0.01" value={formData.aa_rate_per_km} onChange={(e) => setFormData({ ...formData, aa_rate_per_km: e.target.value })} required data-testid="travel-rate-input" />
                  <p className="text-xs text-slate-500">Cost per kilometer for travel calculations</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_tolls">Default Tolls ($)</Label>
                  <Input id="default_tolls" type="number" step="0.01" value={formData.default_tolls} onChange={(e) => setFormData({ ...formData, default_tolls: e.target.value })} required data-testid="travel-tolls-input" />
                  <p className="text-xs text-slate-500">Default toll amount per trip</p>
                </div>
                <Button type="submit" disabled={saving} data-testid="travel-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
