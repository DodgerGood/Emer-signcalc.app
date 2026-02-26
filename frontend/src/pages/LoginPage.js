import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('MANAGER');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Welcome back!');
      } else {
        if (!fullName || !companyName) {
          toast.error('Please fill all fields');
          setLoading(false);
          return;
        }
        await register(email, password, companyName, fullName, role);
        toast.success('Account created successfully!');
      }
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#FDFDFD]">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-[#0F172A]">
              SignageQuote
            </h1>
            <p className="mt-2 text-slate-600">
              {isLogin ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="auth-form">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    data-testid="full-name-input"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Acme Signage Co."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required={!isLogin}
                    data-testid="company-name-input"
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role *</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger data-testid="role-select" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="PROCUREMENT">Procurement</SelectItem>
                      <SelectItem value="QUOTING_STAFF">Quoting Staff</SelectItem>
                      <SelectItem value="CEO">CEO</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Select the appropriate role for this user</p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="email-input"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="password-input"
                  className="h-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="auth-submit-btn"
              className="w-full h-10 bg-[#2563EB] hover:bg-[#1e40af] text-white"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              data-testid="toggle-auth-mode"
              className="text-sm text-[#2563EB] hover:underline"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>

          {/* Demo credentials hint */}
          {isLogin && (
            <div className="mt-6 p-4 bg-slate-100 rounded-md border border-slate-200">
              <p className="text-xs text-slate-600 font-medium mb-2">For testing:</p>
              <p className="text-xs text-slate-500">Create a new account to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side - Image */}
      <div
        className="hidden lg:block flex-1 bg-cover bg-center relative"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1745488018261-13afb4842790?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmFsJTIwcHJpbnQlMjBzdHVkaW8lMjBpbnRlcmlvciUyMHdpZGUlMjBzaG90fGVufDB8fHx8MTc3MTgzOTI4Mnww&ixlib=rb-4.1.0&q=85')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F172A]/90 to-[#2563EB]/70 flex items-center justify-center p-12">
          <div className="text-white max-w-lg">
            <h2 className="text-5xl font-black tracking-tight leading-none mb-6">
              Wide Format Signage Estimating
            </h2>
            <p className="text-lg text-slate-200 leading-relaxed">
              Streamline your signage estimation workflow with precise calculations,
              recipe management, and professional quote generation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}