import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

import {
  Package,
  Warehouse,
  Users,
  Wrench,
  Building2,
  BookOpen,
  Calculator,
  FileText,
  CheckCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const {
    user,
    isManager,
    isProcurement,
    isQuotingStaff,
    isCEO,
    isMDAdmin,
  } = useAuth();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    materials: 0,
    stock: 0,
    labourTypes: 0,
    installTypes: 0,
    clients: 0,
    recipes: 0,
    estimations: 0,
    quotes: 0,
    approved: 0,
  });

  const canViewMaterials = () => isProcurement() || isManager() || isCEO() || isMDAdmin();
  const canViewStock = () => isProcurement() || isManager() || isCEO() || isMDAdmin();
  const canViewLabour = () => isManager() || isCEO() || isMDAdmin();
  const canViewInstallations = () => isManager() || isCEO() || isMDAdmin();
  const canViewClients = () => isQuotingStaff() || isManager() || isCEO() || isMDAdmin();
  const canViewRecipes = () => isManager() || isCEO() || isMDAdmin();
  const canViewEstimations = () => isQuotingStaff() || isMDAdmin();
  const canViewQuotes = () => isQuotingStaff() || isCEO() || isMDAdmin();
  const canViewApproved = () => isQuotingStaff() || isManager() || isCEO() || isMDAdmin();

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);

      const requests = {
        materials: canViewMaterials() ? api.get('/materials') : Promise.resolve({ data: [] }),
        stock: canViewStock() ? api.get('/stock') : Promise.resolve({ data: [] }),
        labourTypes: canViewLabour() ? api.get('/labour-types') : Promise.resolve({ data: [] }),
        installTypes: canViewInstallations() ? api.get('/install-types') : Promise.resolve({ data: [] }),
        clients: canViewClients() ? api.get('/clients') : Promise.resolve({ data: [] }),
        recipes: canViewRecipes() ? api.get('/recipes') : Promise.resolve({ data: [] }),
        quotes: api.get('/quotes'),
        approved: canViewApproved() ? api.get('/approved') : Promise.resolve({ data: [] }),
      };

      const [
        materials,
        stock,
        labourTypes,
        installTypes,
        clients,
        recipes,
        quotes,
        approved,
      ] = await Promise.all([
        requests.materials,
        requests.stock,
        requests.labourTypes,
        requests.installTypes,
        requests.clients,
        requests.recipes,
        requests.quotes,
        requests.approved,
      ]);

      const quoteRows = quotes.data || [];

      setStats({
        materials: (materials.data || []).length,
        stock: (stock.data || []).length,
        labourTypes: (labourTypes.data || []).length,
        installTypes: (installTypes.data || []).length,
        clients: (clients.data || []).length,
        recipes: (recipes.data || []).length,
        estimations: quoteRows.filter((q) => !q.quote_number && !q.invoice_number).length,
        quotes: quoteRows.filter((q) => q.quote_number && !q.invoice_number && q.quote_status !== 'INVOICED').length,
        approved: (approved.data || []).length,
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const dashboardItems = useMemo(() => {
    const items = [
      {
        key: 'materials',
        title: 'Materials',
        value: stats.materials,
        link: '/materials',
        icon: Package,
        canView: canViewMaterials(),
        helperTitle: 'Add Materials',
        helperText: 'Add at least one material before relying on material costing.',
      },
      {
        key: 'stock',
        title: 'Stock',
        value: stats.stock,
        link: '/stock',
        icon: Warehouse,
        canView: canViewStock(),
        helperTitle: 'Set Up Stock',
        helperText: 'Stock will appear here once materials have stock rows to audit.',
      },
      {
        key: 'labourTypes',
        title: 'Labour & Machine',
        value: stats.labourTypes,
        link: '/labour-types',
        icon: Users,
        canView: canViewLabour(),
        helperTitle: 'Add Labour / Machine',
        helperText: 'Add at least one labour or machine cost type.',
      },
      {
        key: 'installTypes',
        title: 'Installations',
        value: stats.installTypes,
        link: '/install-types',
        icon: Wrench,
        canView: canViewInstallations(),
        helperTitle: 'Add Installation',
        helperText: 'Add at least one installation rate before quoting installation work.',
      },
      {
        key: 'clients',
        title: 'Clients',
        value: stats.clients,
        link: '/clients',
        icon: Building2,
        canView: canViewClients(),
        helperTitle: 'Add Clients',
        helperText: 'Add your first client to speed up estimates and statements.',
      },
      {
        key: 'recipes',
        title: 'Recipes',
        value: stats.recipes,
        link: '/recipes',
        icon: BookOpen,
        canView: canViewRecipes(),
        helperTitle: 'Build Recipes',
        helperText: 'Create reusable 1 m² recipes for quoting.',
      },
      {
        key: 'estimations',
        title: 'Estimations',
        value: stats.estimations,
        link: '/estimations',
        icon: Calculator,
        canView: canViewEstimations(),
        helperTitle: 'Create Estimation',
        helperText: 'Create your first estimate before it becomes a quote.',
      },
      {
        key: 'quotes',
        title: 'Quotes',
        value: stats.quotes,
        link: '/quotes',
        icon: FileText,
        canView: canViewQuotes(),
        helperTitle: 'Approve Quote',
        helperText: 'Quotes will show here once estimations are approved.',
      },
      {
        key: 'approved',
        title: 'Approved',
        value: stats.approved,
        link: '/approvals',
        icon: CheckCircle,
        canView: canViewApproved(),
        helperTitle: 'Approved Jobs',
        helperText: 'Approved invoices will appear here after quote conversion.',
      },
    ];

    return items.filter((item) => item.canView);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  const helperItems = dashboardItems.filter((item) => item.value === 0);

  const StatCard = ({ item }) => {
    const Icon = item.icon;

    return (
      <Link to={item.link}>
        <Card className="card-technical cursor-pointer hover:shadow-md transition h-full">
          <CardHeader className="flex flex-row items-start justify-between pb-1">
            <CardTitle className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              {item.title}
            </CardTitle>
            <Icon size={18} className="text-slate-400" strokeWidth={1.5} />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-black tracking-tight data-mono">
              {item.value}
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Welcome back, {user?.full_name}
          </h1>
          <p className="text-slate-600 mt-2">Here&apos;s your overview</p>
        </div>

        {helperItems.length > 0 && (
          <Card className="card-technical border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-blue-900">
                Complete your setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-blue-900">
                These helper blocks disappear automatically once that page has at least one item.
              </p>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {helperItems.map((item) => (
                  <Link
                    key={item.key}
                    to={item.link}
                    className="rounded-lg border border-blue-200 bg-white p-3 hover:border-blue-300 hover:shadow-sm transition"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {item.helperTitle}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {item.helperText}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dashboardItems.map((item) => (
            <StatCard key={item.key} item={item} />
          ))}
        </div>
      </div>
    </Layout>
  );
}
