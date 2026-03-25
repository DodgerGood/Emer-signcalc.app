import React from 'react';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminBillingTrackingPage() {
  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Bill Tracking
          </h1>
          <p className="text-slate-600 mt-2">
            Track payments, balances, and billing status
          </p>
        </div>

        <div className="card-technical p-6">
          <p className="text-slate-600">
            Bill tracking page coming next.
          </p>
        </div>
      </div>
    </PlatformAdminLayout>
  );
}
