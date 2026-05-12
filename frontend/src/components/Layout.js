import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Droplet,
  Users,
  Wrench,
  BookOpen,
  FileText,
  CheckCircle,
  Warehouse,
  LogOut,
  Settings,
  Calculator,
  Building2,
  Headset,
} from 'lucide-react';
import { Button } from './ui/button';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

const role = user?.role;

  const PLATFORM_ADMIN_EMAILS = [
    'signomics@rayline.co.za',
    'rogercameroncook@yahoo.com'
  ];

  const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.includes(
    (user?.email || '').trim().toLowerCase()
  );

  // Role-based navigation
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
        { to: '/approvals', icon: CheckCircle,
  Warehouse, label: 'Approved' },
      ];
    } else if (role === 'MANAGER') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/materials', icon: Package, label: 'Materials' },
        { to: '/stock', icon: Warehouse, label: 'Stock' },
        { to: '/labour-types', icon: Users, label: 'Labour & Machine' },
        { to: '/install-types', icon: Wrench, label: 'Installation Pricelist' },
        { to: '/recipes', icon: BookOpen, label: 'Recipes' },
        { to: '/approvals', icon: CheckCircle,
  Warehouse, label: 'Approved' },
      ];
    } else if (role === 'PROCUREMENT') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/materials', icon: Package, label: 'Materials' },
        { to: '/stock', icon: Warehouse, label: 'Stock' },
      ];
    } else if (role === 'QUOTING_STAFF') {
      return [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/clients', icon: Building2, label: 'Clients' },
        { to: '/estimations', icon: Calculator, label: 'Estimations' },
        { to: '/quotes', icon: FileText, label: 'Quotes' },
        { to: '/approvals', icon: CheckCircle,
  Warehouse, label: 'Approved' },
      ];
    } else if (role === 'CEO') {
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
        { to: '/approvals', icon: CheckCircle,
  Warehouse, label: 'Approved' },
      ];
    }
    return [];
  };

  const links = getLinks();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A] text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight">SignageQuote</h1>
          <p className="text-xs text-slate-400 mt-1">{user?.full_name}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span className="text-sm font-medium">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700 space-y-1">

          {isPlatformAdmin && (
            <Link
              to="/platform-admin/login"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                location.pathname.startsWith('/platform-admin')
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Headset size={18} strokeWidth={1.5} />
              <span className="text-sm font-medium">Platform Support</span>
            </Link>
          )}

          {['MD_ADMIN', 'CEO', 'MANAGER'].includes(role) && (
            <Link
              to="/company-details"
              data-testid="nav-company-details"
              className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
                location.pathname === '/company-details'
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Building2 size={18} strokeWidth={1.5} />
              <span className="text-sm font-medium">Company Details</span>
            </Link>
          )}

          <Link
            to="/settings"
            data-testid="nav-settings"
            className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors ${
              location.pathname === '/settings'
                ? 'bg-[#2563EB] text-white'
                : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Settings size={18} strokeWidth={1.5} />
              <span className="text-sm font-medium">Settings</span>
            </Link>

            <Button
              variant="ghost"
              onClick={logout}
              data-testid="logout-btn"
              className="w-full justify-start text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <LogOut size={18} strokeWidth={1.5} className="mr-3" />
              Logout
            </Button>

          </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
};
