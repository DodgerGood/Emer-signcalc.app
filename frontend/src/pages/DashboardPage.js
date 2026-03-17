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

      if (isQuotingStaff() || isManager() || isCEO()) {
        requests.push(api.get('/quotes'));
      } else {
        requests.push(Promise.resolve({ data: [] }));
      }

      if (isQuotingStaff() || isManager() || isCEO()) {
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

          {(isQuotingStaff() || isManager() || isCEO()) && (
            <StatCard
              icon={FileText}
              title="Quotes"
              value={stats.quotes}
              linkTo="/quotes"
            />
          )}

          {(isQuotingStaff() || isManager() || isCEO()) &&
            stats.pendingApprovals > 0 && (
              <StatCard
                icon={Clock}
                title="Pending Markup Approvals"
                value={stats.pendingApprovals}
                linkTo="/approvals"
              />
            )}

          {(isManager() || isCEO()) &&
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
