import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import api from '../lib/api';
import { Eye, EyeOff, Headset } from 'lucide-react';

export default function PlatformAdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/platform-admin/login', {
        email,
        password,
      });

      if (!response?.data?.is_platform_admin) {
        localStorage.removeItem('platform_admin_auth');
        localStorage.removeItem('platform_admin_email');
        toast.error('This account is not authorized for platform admin.');
        return;
      }

      localStorage.setItem('platform_admin_auth', 'true');
      localStorage.setItem('platform_admin_email', email.trim().toLowerCase());
      toast.success('Platform admin access granted.');
      navigate('/platform-admin/support');
    } catch (error) {
      toast.error(
        error?.response?.data?.detail || 'Admin login failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FDFDFD]">
        <div className="w-full max-w-md space-y-8">
          <div>
            <div className="flex items-center gap-3">
              <Headset className="text-[#2563EB]" size={28} />
              <h1 className="text-4xl font-black tracking-tight text-[#0F172A]">
                Platform Support
              </h1>
            </div>
            <p className="mt-2 text-slate-600">
              Sign in to access support tools, company controls, and seat management.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="platform-admin-email">Email</Label>
              <Input
                id="platform-admin-email"
                type="email"
                placeholder="support@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform-admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="platform-admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#2563EB] hover:bg-[#1e40af] text-white"
            >
              {loading ? 'Signing in...' : 'Sign In to Support'}
            </Button>
          </form>

          <div className="text-center">
            <Link
              to="/login"
              className="text-sm text-[#2563EB] hover:underline"
            >
              Back to main login
            </Link>
          </div>
        </div>
      </div>

      <div
        className="hidden lg:block flex-1 bg-cover bg-center relative"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1521737711867-e3b97375f902?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxjdXN0b21lciUyMHN1cHBvcnQlMjB0ZWFtfGVufDB8fHx8MTc3MTgzOTI4Mnww&ixlib=rb-4.1.0&q=85')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/90 to-[#2563EB]/70 flex items-center justify-center p-12">
          <div className="text-white max-w-lg">
            <h2 className="text-5xl font-black tracking-tight leading-none mb-6">
              Support Operations
            </h2>
            <p className="text-lg text-slate-200 leading-relaxed">
              Manage support requests, company oversight, seat controls, and platform administration from one secure workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
