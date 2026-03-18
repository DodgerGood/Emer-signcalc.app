import React from 'react';
import { PlatformAdminLayout } from '../components/PlatformAdminLayout';

export default function AdminSeatManagementPage() {
  return (
    <PlatformAdminLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">
            Seat Management
          </h1>
          <p className="text-slate-600 mt-2">
            Device assignments, resets, and seat control tools
          </p>
        </div>

        <div className="card-technical p-6">
          <p className="text-slate-600">
            Seat management page coming next.
          </p>
        </div>
      </div>
    </PlatformAdminLayout>
  );
}

