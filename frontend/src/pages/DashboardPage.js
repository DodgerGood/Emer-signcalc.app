import React, { useEffect, useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Package,
  Droplet,
  Users,
  FileText,
  Clock,
  TrendingUp,
  Wrench,
  BookOpen,
  LayoutDashboard,
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

  const [stats, setStats] = useState({
    materials: 0,
    inkProfiles: 0,
    labourTypes: 0,
    installTypes: 0,
    recipes: 0,
    quotes: 0,
    pendingApprovals: 0,
    pendingQuoteApprovals: 0,
  });

  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);

      const requests = [];

      if (isProcurement() || isManager() || isCEO()) {
        requests.push(
          api.get('/materials'),
          api.get('/ink-profiles')
        );
      } else {
        requests.push(
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] })
        );
      }

      if (isManager() || isCEO() || isMDAdmin()) {
        requests.push(
          api.get('/labour-types'),
          api.get('/install-types'),
          api.get('/recipes')
        );
      } else {
        requests.push(
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] }),
          Promise.resolve({ data: [] })
        );
      }

      if (isQuotingStaff() || isMDAdmin()) {
        requests.push(api.get('/quotes'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      if (isQuotingStaff() || isManager() || isCEO() || isMDAdmin()) {
        requests.push(api.get('/approvals'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      if (isCEO()) {
        requests.push(api.get('/quotes/pending-approval/list'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      const [
        materials,
        inks,
        labourTypes,
        installTypes,
        recipes,
        quotes,
        approvals,
        pendingQuotes,
      ] = await Promise.all(requests);

      setStats({
        materials: materials.data.length,
        inkProfiles: inks.data.length,
        labourTypes: labourTypes.data.length,
        installTypes: installTypes.data.length,
        recipes: recipes.data.length,
        quotes: quotes.data.length,
        pendingApprovals: approvals.data.length,
        pendingQuoteApprovals: pendingQuotes.data.length,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  }, [isProcurement, isManager, isCEO, isQuotingStaff, isMDAdmin]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const setupSteps = [];

  if ((isProcurement() || isManager() || isCEO()) && stats.materials === 0) {
    setupSteps.push({
      label: 'Add Materials',
      description: 'Set up the substrates and material costs your business uses.',
      link: '/materials',
    });
  }

  if ((isProcurement() || isManager() || isCEO()) && stats.inkProfiles === 0) {
    setupSteps.push({
      label: 'Add Ink Profiles',
      description: 'Define your ink cost profiles for accurate print costing.',
      link: '/ink-profiles',
    });
  }

  if ((isManager() || isCEO()) && stats.labourTypes === 0) {
    setupSteps.push({
      label: 'Add Labour Rates',
      description: 'Set your labour pricing for production work.',
      link: '/labour-types',
    });
  }

  if ((isManager() || isCEO()) && stats.installTypes === 0) {
    setupSteps.push({
      label: 'Add Installation Rates',
      description: 'Set your installation pricing for crew, equipment, and site work.',
      link: '/install-types',
    });
  }

  if ((isManager() || isCEO()) && stats.recipes === 0) {
    setupSteps.push({
      label: 'Build Recipes',
      description: 'Create reusable pricing assemblies from your costing inputs.',
      link: '/recipes',
    });
  }

  const StatCard = ({ icon: Icon, title, value, linkTo }) => {
    const content = (
      <Card className={`card-technical col-span-1 ${linkTo ? 'cursor-pointer hover:shadow-md transition' : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 uppercase tracking-wide">
            {title}
          </CardTitle>
          <Icon size={20} className="text-slate-400" strokeWidth={1.5} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black tracking-tight data-mono">
            {value}
          </div>
        </CardContent>
      </Card>
    );

    return linkTo ? <Link to={linkTo}>{content}</Link> : content;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent" />
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

        const showSetup =
          stats.materials === 0 &&
          stats.inkProfiles === 0 &&
          stats.labourTypes === 0 &&
          stats.installTypes === 0 &&
          stats.recipes === 0;

        {showSetup && (
          <Card className="card-technical border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-blue-900">
                Complete your costing setup
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-blue-900">
                The zero values below are expected until you configure your own costing data.
                Start with the setup steps below to build your pricing model.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {setupSteps.map((step) => (
                  <Link
                    key={step.label}
                    to={step.link}
                    className="rounded-lg border border-blue-200 bg-white p-4 hover:border-blue-300 hover:shadow-sm transition"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {step.label}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {step.description}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(isProcurement() || isManager() || isCEO() || isMDAdmin()) && (
            <StatCard
              icon={Package}
              title="Materials"
              value={stats.materials}
              linkTo="/materials"
            />
          )}

          {(isProcurement() || isManager() || isCEO() || isMDAdmin()) && (
            <StatCard
              icon={Droplet}
              title="Ink Profiles"
              value={stats.inkProfiles}
              linkTo="/ink-profiles"
            />
          )}
 
          {(isManager() || isCEO() || isMDAdmin()) && ( 
            <StatCard
              icon={Users}
              title="Labour Pricelist"
              value={stats.labourTypes}
              linkTo="/labour-types"
            />
          )}

          {(isManager() || isCEO() || isMDAdmin()) && (
            <StatCard
              icon={Wrench}
              title="Installation Pricelist"
              value={stats.installTypes}
              linkTo="/install-types"
            />
          )}

          {(isManager() || isCEO() || isMDAdmin()) && (
            <StatCard
              icon={BookOpen}
              title="Recipes"
              value={stats.recipes}
              linkTo="/recipes"
            />
          )}

          {(isQuotingStaff() || isMDAdmin()) && (
            <StatCard
              icon={FileText}
              title="Quotes"
              value={stats.quotes}
              linkTo="/quotes"
            />
          )}

          {(isQuotingStaff() || isManager() || isCEO() || isMDAdmin()) &&
            stats.pendingApprovals > 0 && (
              <StatCard
                icon={Clock}
                title="Pending Markup Approvals"
                value={stats.pendingApprovals}
                linkTo="/approvals"
              />
          )}

          {(isCEO() || isMDAdmin()) && stats.pendingQuoteApprovals > 0 && (
            <StatCard
              icon={LayoutDashboard}
              title="Quotes Awaiting Approval"
              value={stats.pendingQuoteApprovals}
              linkTo="/quotes"
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
