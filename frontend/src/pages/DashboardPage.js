import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'lucide-react';

export default function DashboardPage() {
  const {
    user,
    isManager,
    isProcurement,
    isQuotingStaff,
    isCEO,
  } = useAuth();

  const [stats, setStats] = useState({
    materials: 0,
    inkProfiles: 0,
    recipes: 0,
    quotes: 0,
    pendingApprovals: 0,
    pendingQuoteApprovals: 0,
  });

  const [loading, setLoading] = useState(true);

  const setupSteps = useMemo(() => {
    const steps = [];

    if ((isProcurement() || isManager() || isCEO()) && stats.materials === 0) {
      steps.push({
        label: 'Add Materials',
        description: 'Set up the substrates and material costs your business uses.',
        link: '/materials',
      });
    }

    if ((isProcurement() || isManager() || isCEO()) && stats.inkProfiles === 0) {
      steps.push({
        label: 'Add Ink Profiles',
        description: 'Define your ink cost profiles for accurate print costing.',
        link: '/ink-profiles',
      });
    }

    if ((isManager() || isCEO()) && stats.recipes === 0) {
      steps.push({
        label: 'Build Recipes',
        description: 'Create reusable pricing assemblies from your costing inputs.',
        link: '/recipes',
      });
    }

    if (isQuotingStaff() && stats.quotes === 0) {
      steps.push({
        label: 'Create Quotes',
        description: 'Start creating quotes once your costing setup is in place.',
        link: '/quotes',
      });
    }

    return steps;
  }, [stats, isProcurement, isManager, isCEO, isQuotingStaff]);
  const loadStats = useCallback(async () => {
    try {
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

      if (isManager() || isCEO()) {
        requests.push(api.get('/recipes'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      if (isQuotingStaff()) {
        requests.push(api.get('/quotes'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      if (isQuotingStaff()) {
        requests.push(api.get('/approvals'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      if (isManager() || isCEO()) {
        requests.push(api.get('/quotes/pending-approval/list'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      const [
        materials,
        inks,
        recipes,
        quotes,
        approvals,
        pendingQuotes,
      ] = await Promise.all(requests);

      setStats({
        materials: materials.data.length,
        inkProfiles: inks.data.length,
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
 }, [isProcurement, isManager, isCEO, isQuotingStaff]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const StatCard = ({ icon: Icon, title, value, linkTo, gridSpan }) => {
    const content = (
      <Card
        className={`card-technical ${
          gridSpan || 'col-span-1 md:col-span-2 lg:col-span-3'
        } ${linkTo ? 'cursor-pointer hover:shadow-md transition' : ''}`}
      >
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

        {setupSteps.length > 0 && (
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

        <div className="bento-grid">
          {(isProcurement() || isManager() || isCEO()) && (
            <>
              <StatCard
                icon={Package}
                title="Materials"
                value={stats.materials}
                linkTo="/materials"
              />
              <StatCard
                icon={Droplet}
                title="Ink Profiles"
                value={stats.inkProfiles}
                linkTo="/ink-profiles"
              />
            </>
          )}

          {(isManager() || isCEO()) && (
            <StatCard
              icon={Users}
              title="Recipes"
              value={stats.recipes}
              linkTo="/recipes"
            />
          )}

          {isQuotingStaff() && (
            <StatCard
              icon={FileText}
              title="Quotes"
              value={stats.quotes}
              linkTo="/quotes"
            />
          )}

          {isQuotingStaff() &&
            stats.pendingApprovals > 0 && (
              <StatCard
                icon={Clock}
                title="Pending Markup Approvals"
                value={stats.pendingApprovals}
                linkTo="/approvals"
              />
          )}

          {isCEO() &&
            stats.pendingQuoteApprovals > 0 && (
              <StatCard
                icon={FileText}
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
