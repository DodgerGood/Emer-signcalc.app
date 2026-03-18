import React from 'react';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminCommissioningPage() {
  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Commissioning
          </h1>
          <p className="text-slate-600 mt-2">
            Onboarding, approvals, invoicing, and activation workflow
          </p>
        </div>

        <div className="card-technical p-6">
          <p className="text-slate-600">
            Commissioning page coming next.
          </p>
        </div>
      </div>
    </PlatformAdminLayout>
  );
}
