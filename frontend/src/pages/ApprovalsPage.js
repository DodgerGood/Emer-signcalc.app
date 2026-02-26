import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadApprovals(); }, []);

  const loadApprovals = async () => {
    try {
      const response = await api.get('/approvals');
      setApprovals(response.data);
    } catch (error) {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/approvals/${id}/approve`);
      toast.success('Request approved');
      loadApprovals();
    } catch (error) {
      toast.error('Failed to approve request');
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/approvals/${id}/reject`);
      toast.success('Request rejected');
      loadApprovals();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">Markup Approvals</h1>
          <p className="text-slate-600 mt-2">Review and approve markup override requests</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>
        ) : approvals.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-slate-500">No pending approvals</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <Card key={approval.id} className="card-technical" data-testid={`approval-${approval.id}`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="font-bold text-lg">Markup Override Request</h3>
                      <p className="text-sm text-slate-600">Requested by: <span className="font-medium">{approval.requested_by_name}</span></p>
                      <p className="text-sm text-slate-600">Quote ID: <span className="font-mono">{approval.quote_id}</span></p>
                      <div className="flex gap-4 mt-3">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">Original Markup</p>
                          <p className="text-xl font-mono font-bold">{approval.original_markup}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider">Requested Markup</p>
                          <p className="text-xl font-mono font-bold text-[#2563EB]">{approval.requested_markup}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleApprove(approval.id)} data-testid={`approve-${approval.id}`} className="bg-green-600 hover:bg-green-700">
                        <CheckCircle size={18} className="mr-2" />Approve
                      </Button>
                      <Button onClick={() => handleReject(approval.id)} data-testid={`reject-${approval.id}`} variant="destructive">
                        <XCircle size={18} className="mr-2" />Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
