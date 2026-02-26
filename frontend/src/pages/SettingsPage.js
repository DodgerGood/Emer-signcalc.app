import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Lock, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword
      });
      toast.success('Password changed successfully');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-2xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">Settings</h1>
          <p className="text-slate-600 mt-2">Manage your account settings</p>
        </div>

        {/* Account Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} />
              Account Information
            </CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Full Name</p>
                <p className="font-medium">{user?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium">{user?.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Role</p>
                <p className="font-medium">{user?.role}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Change Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock size={20} />
              Change Password
            </CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  required
                  data-testid="current-password-input"
                  placeholder="Enter your current password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  required
                  data-testid="new-password-input"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  data-testid="confirm-password-input"
                  placeholder="Confirm your new password"
                />
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                data-testid="change-password-btn"
                className="bg-[#2563EB] hover:bg-[#1e40af]"
              >
                {loading ? 'Changing...' : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Session Security Notice */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={20} />
              Session Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">
              For your security, if you attempt to log in from another device while already logged in, 
              all sessions will be terminated and your account will be locked for <strong>3 hours</strong>. 
              Please log out properly before switching devices to avoid this lockout.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
