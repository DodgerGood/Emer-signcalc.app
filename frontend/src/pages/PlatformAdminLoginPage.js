import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';

const PLATFORM_ADMIN_EMAILS = [
  'signomics@rayline.co.za',
  'rogercameroncook@yahoo.com'
];

export default function PlatformAdminLoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);

        const normalizedEmail = email.trim().toLowerCase();

        if (!PLATFORM_ADMIN_EMAILS.includes(normalizedEmail)) {
        localStorage.removeItem('platform_admin_auth');
        toast.error('This account is not authorized for platform admin.');
        setLoading(false);
        return;
      }

      localStorage.setItem('platform_admin_auth', 'true');
      toast.success('Platform admin access granted.');
      navigate('/platform-admin/support');
    } catch (error) {
      toast.error(error?.message || 'Admin login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Platform Admin Login
          </h1>
          <p className="text-slate-600 mt-2">
            Sign in to access support and platform controls
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2563EB] hover:bg-[#1e40af] text-white"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
