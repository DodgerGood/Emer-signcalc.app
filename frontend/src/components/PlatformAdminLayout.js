import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Headset,
  Building2,
  Settings,
  ArrowLeftRight,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function PlatformAdminLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const mainRef = useRef(null);
  const navRef = useRef(null);

  // Main body always opens at top when changing platform-admin pages.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const saveSidebarScroll = () => {
    if (!navRef.current) return;

    const value = navRef.current.scrollTop;
    window.__signomicsPlatformSidebarScrollTop = value;
    sessionStorage.setItem('signomics-platform-sidebar-scroll-top', String(value));
  };

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
      label: 'Bill Tracking',
      href: '/platform-admin/billing-tracking',
      icon: ArrowLeftRight,
    },
    {
      label: 'Bill Invoicing',
      href: '/platform-admin/seats',
      icon: ArrowLeftRight,
    },
  ];

  const utilityItems = [
    {
      label: 'Back to Main App',
      href: '/',
      icon: ArrowLeftRight,
    },
    {
      label: 'Admin Settings',
      href: '/platform-admin/settings',
      icon: Settings,
    },
  ];

  const getLinkClass = (active) => (
    `flex items-center gap-3 rounded-xl px-4 py-3 transition ${
      active
        ? 'bg-[#2563EB] text-white'
        : 'text-slate-200 hover:bg-slate-800 hover:text-white'
    }`
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#F8FAFC]">
      <aside className="h-[100dvh] max-h-[100dvh] w-[280px] shrink-0 overflow-hidden border-r border-slate-800 bg-[#0F172A] text-white">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-slate-700 px-8 py-8">
            <div className="text-4xl font-black tracking-tight leading-none">
              SignageQuote
            </div>

            <div className="mt-4">
              <div className="text-xl font-semibold">Platform Admin</div>
              <div className="mt-2 truncate text-slate-300">{user?.full_name}</div>
              <div className="truncate text-slate-400">{user?.role}</div>
            </div>
          </div>

          <nav
            ref={navRef}
            onScroll={saveSidebarScroll}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-6 pb-40 touch-pan-y"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={saveSidebarScroll}
                  className={getLinkClass(active)}
                >
                  <Icon size={20} className="shrink-0" />
                  <span className="text-lg">{item.label}</span>
                </Link>
              );
            })}

            <div className="mt-5 border-t border-slate-700 pt-5">
              {utilityItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={saveSidebarScroll}
                    className={getLinkClass(active)}
                  >
                    <Icon size={20} className="shrink-0" />
                    <span className="text-lg">{item.label}</span>
                  </Link>
                );
              })}

              <button
                type="button"
                onClick={logout}
                className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-200 transition hover:bg-red-900/40 hover:text-white"
              >
                <LogOut size={20} className="shrink-0 text-red-300" />
                <span className="text-lg">Logout</span>
              </button>
            </div>

            <div className="h-24 shrink-0" aria-hidden="true" />
          </nav>
        </div>
      </aside>

      <main
        ref={mainRef}
        className="h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F8FAFC] py-8 pl-8 pr-[12mm] overscroll-contain touch-pan-y"
      >
        <div className="min-w-0 pr-[7mm]">
          <div className="mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center rounded bg-slate-100 px-3 py-2 text-sm text-slate-900 hover:bg-slate-200"
            >
              ← Back
            </button>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
