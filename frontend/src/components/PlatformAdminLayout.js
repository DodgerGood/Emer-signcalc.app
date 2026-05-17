import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Headset,
  Building2,
  Settings,
  ArrowLeftRight,
  ShieldCheck,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

export function PlatformAdminLayout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const mainRef = useRef(null);
  const navRef = useRef(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('signomics-platform-sidebar-collapsed');

    if (saved === null) {
      return true;
    }

    return saved === 'true';
  });

  const [platformSettings, setPlatformSettings] = useState({
    trading_name: '',
    company_name: '',
    platform_logo_data_url: '',
    logo_data_url: '',
  });

  useEffect(() => {
    localStorage.setItem('signomics-platform-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    let isMounted = true;

    api.get('/admin/platform-settings')
      .then((response) => {
        if (isMounted) {
          setPlatformSettings(response.data || {});
        }
      })
      .catch(() => {
        // Keep default branding if settings are not available.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Main body opens at the top on page change. Sidebar is NOT moved.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });

      mainRef.current
        .querySelectorAll('.overflow-x-auto, [data-reset-horizontal-scroll="true"]')
        .forEach((element) => {
          element.scrollLeft = 0;
        });
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

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
      label: 'Admin Settings',
      href: '/platform-admin/settings',
      icon: Settings,
    },
  ];

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname === href || location.pathname.startsWith(`${href}/`);
  };

  const getLinkClass = (active) => {
    const base = sidebarCollapsed
      ? 'flex min-h-[50px] w-full flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors'
      : 'flex w-full items-center gap-3 rounded-xl px-4 py-3 transition-colors';

    const tone = active
      ? 'bg-[#2563EB] text-white'
      : 'text-slate-200 hover:bg-slate-800 hover:text-white';

    return `${base} ${tone}`;
  };

  const labelClass = sidebarCollapsed
    ? 'block max-w-[58px] text-center text-[8px] font-medium leading-tight'
    : 'text-lg';

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        to={item.href}
        className={getLinkClass(active)}
        title={item.label}
      >
        <Icon size={20} className="shrink-0" />
        <span className={labelClass}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#F8FAFC]">
      <aside
        className={`${
          sidebarCollapsed ? 'w-[68px]' : 'w-64'
        } h-[100dvh] max-h-[100dvh] shrink-0 overflow-hidden border-r border-slate-800 bg-[#0F172A] text-white transition-all duration-300`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className={`${sidebarCollapsed ? 'p-2' : 'p-6'} shrink-0 border-b border-slate-700`}>
            <div className={sidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-start justify-between gap-3'}>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  {(platformSettings.platform_logo_data_url || platformSettings.logo_data_url) ? (
                    <img
                      src={platformSettings.platform_logo_data_url || platformSettings.logo_data_url}
                      alt="Platform logo"
                      className="mb-3 max-h-14 max-w-full object-contain"
                    />
                  ) : (
                    <div className="text-xl font-bold tracking-tight">
                      {platformSettings.trading_name || platformSettings.company_name || 'SignageQuote'}
                    </div>
                  )}
                  <div className="mt-2 text-sm font-semibold">Platform Admin</div>
                  <div className="mt-1 truncate text-xs text-slate-300">{user?.full_name}</div>
                  <div className="truncate text-xs text-slate-400">{user?.role}</div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="rounded-md border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                title={sidebarCollapsed ? 'Expand menu' : 'Collapse menu'}
              >
                {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
              </button>
            </div>

            {sidebarCollapsed && (
              <div className="mt-1 flex flex-col items-center gap-1">
                {(platformSettings.platform_logo_data_url || platformSettings.logo_data_url) ? (
                  <img
                    src={platformSettings.platform_logo_data_url || platformSettings.logo_data_url}
                    alt="Platform logo"
                    className="max-h-8 max-w-[44px] object-contain"
                  />
                ) : null}
                <div className="truncate text-center text-[8px] leading-tight text-slate-400" title={user?.full_name}>
                  {user?.full_name?.split(' ')[0] || 'Admin'}
                </div>
              </div>
            )}
          </div>

          <nav
            ref={navRef}
            className={`${sidebarCollapsed ? 'p-1.5 pb-56' : 'p-4 pb-56'} min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain touch-pan-y`}
          >
            {navItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}

            <div className="mt-4 border-t border-slate-700 pt-4">
              {utilityItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}

              <button
                type="button"
                onClick={logout}
                title="Logout"
                className={`${
                  sidebarCollapsed
                    ? 'flex min-h-[50px] w-full flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors'
                    : 'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors'
                } mt-1 text-slate-200 hover:bg-red-900/40 hover:text-white`}
              >
                <LogOut size={20} className="shrink-0 text-red-300" />
                <span className={labelClass}>Logout</span>
              </button>
            </div>

            <div className="h-32 shrink-0" aria-hidden="true" />
          </nav>
        </div>
      </aside>

      <main
        ref={mainRef}
        className="h-[100dvh] min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#F8FAFC] py-8 pl-8 pr-[12mm] overscroll-contain touch-pan-y"
      >
        <div className="min-w-0 w-full box-border py-8 pl-8 pr-[7mm]">{children}</div>
      </main>
    </div>
  );
}
