import React, { useEffect, useState } from 'react';
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
  const { user, isManager, isProcurement, isQuotingStaff, isCEO } = useAuth();
  const [stats, setStats] = useState({
    materials: 0,
    inkProfiles: 0,
    recipes: 0,
    quotes: 0,
    pendingApprovals: 0,
    pendingQuoteApprovals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const requests = [];
      
      if (isProcurement() || isManager() || isCEO()) {
        requests.push(api.get('/materials'), api.get('/ink-profiles'));
      } else {
        requests.push(Promise.resolve({ data: [] }), Promise.resolve({ data: [] }));
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

      const [materials, inks, recipes, quotes, approvals, pendingQuotes] = await Promise.all(requests);

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
  };

  const StatCard = (props) => {
    const Icon = props.icon;
    const gridSpan = props.gridSpan || 'col-span-1 md:col-span-2 lg:col-span-3';
    const content = (
      <Card
        className={`card-technical ${gridSpan} ${props.linkTo ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
        data-testid={`stat-card-${props.title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 uppercase tracking-widest">
            {props.title}
          </CardTitle>
          <Icon size={20} className="text-slate-400" strokeWidth={1.5} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black tracking-tight data-mono">{props.value}</div>
          {props.trend && (
            <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
              <TrendingUp size={14} />
              <span>{props.trend}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
    
    return props.linkTo ? <Link to={props.linkTo}>{content}</Link> : content;
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
          <p className="text-slate-600 mt-2">Here's your overview</p>
        </div>

        {/* Bento Grid Stats */}
        <div className="bento-grid" data-testid="dashboard-stats">
          {(isProcurement() || isManager() || isCEO()) && (
            <>
              <StatCard
                icon={Package}
                title="Materials"
                value={stats.materials}
                linkTo="/materials"
                gridSpan="col-span-1 md:col-span-2 lg:col-span-3"
              />
              <StatCard
                icon={Droplet}
                title="Ink Profiles"
                value={stats.inkProfiles}
                linkTo="/ink-profiles"
                gridSpan="col-span-1 md:col-span-2 lg:col-span-3"
              />
            </>
          )}
          {(isManager() || isCEO()) && (
            <StatCard
              icon={Users}
              title="Recipes"
              value={stats.recipes}
              linkTo="/recipes"
              gridSpan="col-span-1 md:col-span-2 lg:col-span-3"
            />
          )}
          {(isQuotingStaff() || isManager() || isCEO()) && (
            <StatCard
              icon={FileText}
              title="Quotes"
              value={stats.quotes}
              linkTo="/quotes"
              gridSpan="col-span-1 md:col-span-2 lg:col-span-3"
            />
          )}
          {(isQuotingStaff() || isManager() || isCEO()) && stats.pendingApprovals > 0 && (
            <StatCard
              icon={Clock}
              title="Pending Markup Approvals"
              value={stats.pendingApprovals}
              linkTo="/approvals"
              gridSpan="col-span-1 md:col-span-2 lg:col-span-3"
            />
          )}
          {(isManager() || isCEO()) && stats.pendingQuoteApprovals > 0 && (
            <StatCard
              icon={FileText}
              title="Quotes Awaiting Approval"
              value={stats.pendingQuoteApprovals}
              linkTo="/quotes"
              gridSpan="col-span-1 md:col-span-2 lg:col-span-3"
            />
          )}
        </div>

        {/* Quick Actions */}
        <Card className="card-technical">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isManager() && (
                <a
                  href="/recipes"
                  data-testid="quick-action-create-recipe"
                  className="p-4 border border-slate-200 rounded-md hover:border-accent hover:shadow-md transition-all"
                >
                  <h3 className="font-bold text-slate-900">Create Recipe</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Build a new pricing assembly
                  </p>
                </a>
              )}
              {(isQuotingStaff() || isCEO()) && (
                <a
                  href="/quotes"
                  data-testid="quick-action-new-quote"
                  className="p-4 border border-slate-200 rounded-md hover:border-accent hover:shadow-md transition-all"
                >
                  <h3 className="font-bold text-slate-900">New Quote</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Start a new client estimate
                  </p>
                </a>
              )}
              {(isQuotingStaff() || isManager() || isCEO()) && stats.pendingApprovals > 0 && (
                <a
                  href="/approvals"
                  data-testid="quick-action-review-approvals"
                  className="p-4 border border-slate-200 rounded-md hover:border-accent hover:shadow-md transition-all"
                >
                  <h3 className="font-bold text-slate-900">Review Approvals</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {stats.pendingApprovals} pending markup{' '}
                    {stats.pendingApprovals === 1 ? 'request' : 'requests'}
                  </p>
                </a>
              )}
              {(isProcurement() || isCEO()) && (
                <a
                  href="/materials"
                  data-testid="quick-action-manage-materials"
                  className="p-4 border border-slate-200 rounded-md hover:border-accent hover:shadow-md transition-all"
                >
                  <h3 className="font-bold text-slate-900">Manage Materials</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Update material pricelist
                  </p>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}