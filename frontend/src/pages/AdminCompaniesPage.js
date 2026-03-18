import React from 'react';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminCompaniesPage() {
  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Companies
          </h1>
          <p className="text-slate-600 mt-2">
            Company records, seat activity, and lockout monitoring
          </p>
        </div>

        <div className="card-technical p-6">
          <p className="text-slate-600">
            Companies page coming next.
          </p>
        </div>
      </div>
    </PlatformAdminLayout>
  );
}
