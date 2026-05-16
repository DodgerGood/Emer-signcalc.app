import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Users,
  Wrench,
  BookOpen,
  FileText,
  CheckCircle,
  Factory,
  Warehouse,
  LogOut,
  Settings,
  Calculator,
  Building2,
  Headset,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { Button } from './ui/button';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('signomics-sidebar-collapsed') === 'true';
  });
  const activeNavRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('signomics-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    window.setTimeout(() => {
      if (activeNavRef.current) {
        activeNavRef.current.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'smooth',
        });
      }
    }, 80);
  }, [location.pathname, sidebarCollapsed]);

  const role = user?.role;

  const PLATFORM_ADMIN_EMAILS = [
    'signomics@rayline.co.za',
    'rogercameroncook@yahoo.com',
  ];

  const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.includes(
    (user?.email || '').trim().toLowerCase()
  );

  const getLinks = () => {
    if (role === 'MD_ADMIN') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/materials', icon: Package, label: 'Materials' },
        { to: '/stock', icon: Warehouse, label: 'Stock' },
        { to: '/labour-types', icon: Users, label: 'Labour & Machine' },
        { to: '/install-types', icon: Wrench, label: 'Installation Pricelist' },
        { to: '/recipes', icon: BookOpen, label: 'Recipes' },
        { to: '/clients', icon: Building2, label: 'Clients' },
        { to: '/estimations', icon: Calculator, label: 'Estimations' },
        { to: '/quotes', icon: FileText, label: 'Quotes' },
        { to: '/approvals', icon: CheckCircle, label: 'Approved' },
        { to: '/production', icon: Factory, label: 'Production Tracking' },
      ];
    }

    if (role === 'MANAGER') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/materials', icon: Package, label: 'Materials' },
        { to: '/stock', icon: Warehouse, label: 'Stock' },
        { to: '/labour-types', icon: Users, label: 'Labour & Machine' },
        { to: '/install-types', icon: Wrench, label: 'Installation Pricelist' },
        { to: '/recipes', icon: BookOpen, label: 'Recipes' },
        { to: '/approvals', icon: CheckCircle, label: 'Approved' },
        { to: '/production', icon: Factory, label: 'Production Tracking' },
      ];
    }

    if (role === 'PROCUREMENT') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/materials', icon: Package, label: 'Materials' },
        { to: '/stock', icon: Warehouse, label: 'Stock' },
      ];
    }

    if (role === 'QUOTING_STAFF') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clients', icon: Building2, label: 'Clients' },
        { to: '/estimations', icon: Calculator, label: 'Estimations' },
        { to: '/quotes', icon: FileText, label: 'Quotes' },
        { to: '/approvals', icon: CheckCircle, label: 'Approved' },
        { to: '/production', icon: Factory, label: 'Production Tracking' },
      ];
    }

    if (role === 'CEO') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/materials', icon: Package, label: 'Materials' },
        { to: '/stock', icon: Warehouse, label: 'Stock' },
        { to: '/labour-types', icon: Users, label: 'Labour & Machine' },
        { to: '/install-types', icon: Wrench, label: 'Installation Pricelist' },
        { to: '/recipes', icon: BookOpen, label: 'Recipes' },
        { to: '/clients', icon: Building2, label: 'Clients' },
        { to: '/estimations', icon: Calculator, label: 'Estimations' },
        { to: '/quotes', icon: FileText, label: 'Quotes' },
        { to: '/approvals', icon: CheckCircle, label: 'Approved' },
        { to: '/production', icon: Factory, label: 'Production Tracking' },
      ];
    }

    return [];
  };

  const links = getLinks();

  const getNavClass = (active) => {
    const base = sidebarCollapsed
      ? 'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-center transition-colors'
      : 'flex items-center gap-3 rounded-md px-4 py-2.5 transition-colors';

    const tone = active
      ? 'bg-[#2563EB] text-white'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white';

    return `${base} ${tone}`;
  };

  const labelClass = sidebarCollapsed
    ? 'block max-w-[58px] text-center text-[8px] font-medium leading-tight'
    : 'text-sm font-medium';

  const NavLinkItem = ({ to, icon: Icon, label, testId }) => {
    const active = to === '/' ? location.pathname === '/' : location.pathname === to;

    return (
      <Link
        to={to}
        data-testid={testId || `nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
        className={getNavClass(active)}
        title={label}
      >
        <Icon size={18} strokeWidth={1.5} className="shrink-0" />
        <span className={labelClass}>{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className={`${
          sidebarCollapsed ? 'w-[68px]' : 'w-64'
        } sticky top-0 h-screen shrink-0 bg-[#0F172A] text-white flex flex-col overflow-hidden transition-all duration-300`}
      >
        <div className={`${sidebarCollapsed ? 'p-2' : 'p-6'} border-b border-slate-700`}>
          <div className={sidebarCollapsed ? 'flex flex-col items-center gap-2' : 'flex items-start justify-between gap-3'}>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight">SignageQuote</h1>
                <p className="text-xs text-slate-400 mt-1 truncate">{user?.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.role}</p>
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
            <div className="mt-1 truncate text-center text-[8px] leading-tight text-slate-400" title={user?.full_name}>
              {user?.full_name?.split(' ')[0] || 'User'}
            </div>
          )}
        </div>

        <nav className={`${sidebarCollapsed ? 'p-1.5' : 'p-4'} min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain touch-pan-y`}>
          {links.map((link) => (
            <NavLinkItem
              key={link.to}
              to={link.to}
              icon={link.icon}
              label={link.label}
            />
          ))}
        </nav>

        <div className={`${sidebarCollapsed ? 'p-1.5' : 'p-4'} shrink-0 border-t border-slate-700 space-y-1`}>
          {isPlatformAdmin && (
            <NavLinkItem
              to="/platform-admin/login"
              icon={Headset}
              label="Platform Support"
            />
          )}

          {['MD_ADMIN', 'CEO', 'MANAGER'].includes(role) && (
            <NavLinkItem
              to="/company-details"
              icon={Building2}
              label="Company Details"
              testId="nav-company-details"
            />
          )}

          <NavLinkItem
            to="/settings"
            icon={Settings}
            label="Settings"
            testId="nav-settings"
          />

          <Button
            variant="ghost"
            onClick={logout}
            data-testid="logout-btn"
            title="Logout"
            className={`${
              sidebarCollapsed
                ? 'flex h-auto w-full flex-col items-center justify-center gap-1 px-1 py-2 text-center'
                : 'w-full justify-start gap-3 px-4 py-2.5'
            } text-slate-300 hover:bg-slate-800 hover:text-white`}
          >
            <LogOut size={18} strokeWidth={1.5} className="shrink-0" />
            <span className={labelClass}>Logout</span>
          </Button>
        </div>
      </aside>

      <main className="h-screen flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 p-8 overscroll-contain touch-pan-y">
        {children}
      </main>
    </div>
  );
};
