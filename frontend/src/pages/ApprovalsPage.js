import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';

import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

import { FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';

const money = (value) => `R ${(Number(value) || 0).toFixed(2)}`;

export default function ApprovalsPage() {
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadApprovedJobs();
  }, []);

  const loadApprovedJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/approved');
      setApprovedJobs(response.data || []);
    } catch {
      toast.error('Failed to load approved jobs');
    } finally {
      setLoading(false);
    }
  };

  const downloadInvoice = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/invoice/pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${job.invoice_number || 'invoice'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  const downloadBom = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/bom/pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${job.invoice_number || 'job'}-BOM.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('BOM PDF is not ready yet');
    }
  };

  const uploadProof = () => {
    toast.info('Proof upload will be added in the next step');
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">Approved</h1>
          <p className="text-slate-600 mt-2">
            Approved invoices, BOM documents, and design proofs for production handover.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table className="w-full min-w-[900px] text-sm">
              <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <TableRow>
                  <TableHead className="px-4 py-3">Client Name</TableHead>
                  <TableHead className="px-4 py-3">Invoice</TableHead>
                  <TableHead className="px-4 py-3">BOM</TableHead>
                  <TableHead className="px-4 py-3">Design Proof</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y">
                {approvedJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-slate-500">
                      No approved invoices yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  approvedJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="px-4 py-3 font-semibold">
                        {job.client_name}
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoice(job)}
                        >
                          <FileText size={16} className="mr-2" />
                          {job.invoice_number || 'Invoice PDF'}
                        </Button>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => downloadBom(job)}
                        >
                          <FileText size={16} className="mr-2" />
                          BOM PDF
                        </Button>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={uploadProof}
                        >
                          <Upload size={16} className="mr-2" />
                          Upload Proof
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
