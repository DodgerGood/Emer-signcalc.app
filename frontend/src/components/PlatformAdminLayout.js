import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Headset, Building2, Settings, ArrowLeftRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function PlatformAdminLayout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    {
      label: 'Support Requests',
      href: '/platform-admin/support',
      icon: Headset,
    },
    {
      label: 'Companies',
      href: '/platform-admin/companies',
      icon: Building2,
    },
    {
      label: 'Commissioning',
      href: '/platform-admin/commissioning',
      icon: ShieldCheck,
    },
    {
      label: 'Seat Management',
      href: '/platform-admin/seats',
      icon: ArrowLeftRight,
    },
  ];

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <aside className="w-[280px] min-h-screen bg-[#0F172A] text-white flex flex-col border-r border-slate-800">
        <div className="px-8 py-8 border-b border-slate-700">
          <div className="text-4xl font-black tracking-tight leading-none">
            SignageQuote
          </div>
          <div className="mt-4">
            <div className="text-xl font-semibold">Platform Admin</div>
            <div className="text-slate-300 mt-2">{user?.full_name}</div>
            <div className="text-slate-400">{user?.role}</div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span className="text-lg">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-6 border-t border-slate-700 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-white transition"
          >
            <ArrowLeftRight size={20} />
            <span className="text-lg">Back to Main App</span>
          </Link>

          <Link
            to="/platform-admin/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-white transition"
          >
            <Settings size={20} />
            <span className="text-lg">Admin Settings</span>
          </Link>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-200 hover:bg-slate-800 hover:text-white transition text-left"
          >
            <Settings size={20} />
            <span className="text-lg">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}

