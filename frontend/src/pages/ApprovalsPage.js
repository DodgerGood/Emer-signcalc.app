import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

import { FileText, Upload, Trash2, RotateCcw, PackageCheck, Factory } from 'lucide-react';
import { toast } from 'sonner';

export default function ApprovalsPage() {
  const { user } = useAuth();
  const canMoveBackToQuote = ['MD_ADMIN', 'MANAGER', 'CEO'].includes(user?.role);

  const [approvedJobs, setApprovedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  useEffect(() => {
    loadApprovedJobs();
  }, []);

  const loadApprovedJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/approved');
      setApprovedJobs(response.data || []);
      setCurrentPage(1);
    } catch {
      toast.error('Failed to load approved jobs');
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (response, filename) => {
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  };

  const downloadInvoice = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/invoice/pdf`, {
        responseType: 'blob',
      });

      const clientName = (job.client_name || 'client').replaceAll(' ', '_');
      const datePart = (job.invoice_created_at || job.created_at || '').slice(0, 10);
      downloadFile(response, `${job.invoice_number || 'invoice'}-${clientName}-${datePart}.pdf`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download invoice');
    }
  };

  const downloadBom = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/bom/pdf`, {
        responseType: 'blob',
      });

      downloadFile(response, `${job.invoice_number || 'job'}-BOM.pdf`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'BOM PDF is not ready yet');
    }
  };

  const uploadProof = () => {
    toast.info('Proof upload will be connected in the next step');
  };

  const createJobPack = async (job) => {
    toast.info(`Create Job Pack for ${job.invoice_number || 'invoice'} will be connected in the next step`);
  };

  const trackProduction = async (job) => {
    toast.info(`Production tracking for ${job.invoice_number || 'invoice'} will be connected in the next step`);
  };

  const deleteApproved = async (job) => {
    if (!window.confirm(`Delete approved invoice ${job.invoice_number || ''}?`)) return;

    try {
      await api.delete(`/approved/${job.id}`);
      toast.success('Approved invoice deleted');
      loadApprovedJobs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete approved invoice');
    }
  };

  const moveBackToQuote = async (job) => {
    if (!window.confirm(`Move ${job.invoice_number || 'this invoice'} back to quoting?`)) return;

    try {
      await api.post(`/approved/${job.id}/move-back-to-quote`);
      toast.success('Invoice moved back to Quotes');
      loadApprovedJobs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to move invoice back');
    }
  };

  const totalPages = Math.max(1, Math.ceil(approvedJobs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedJobs = approvedJobs.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Approved</h1>
            <p className="text-slate-600 mt-2">
              Approved invoices, BOM documents, design proofs, job packs, and production handover.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table className="w-full min-w-[1200px] text-sm">
              <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <TableRow>
                  <TableHead className="px-4 py-3">Client Name</TableHead>
                  <TableHead className="px-4 py-3">Invoice</TableHead>
                  <TableHead className="px-4 py-3">BOM</TableHead>
                  <TableHead className="px-4 py-3">Design Proof</TableHead>
                  <TableHead className="px-4 py-3">Job Pack</TableHead>
                  <TableHead className="px-4 py-3">Production</TableHead>
                  <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y">
                {approvedJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-slate-500">
                      No approved invoices yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedJobs.map((job) => (
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

                      <TableCell className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => createJobPack(job)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <PackageCheck size={16} className="mr-2" />
                          Create Job Pack
                        </Button>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => trackProduction(job)}
                        >
                          <Factory size={16} className="mr-2" />
                          Track Production
                        </Button>
                      </TableCell>

                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {canMoveBackToQuote && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => moveBackToQuote(job)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Move back to quoting"
                            >
                              <RotateCcw size={16} />
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteApproved(job)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete approved invoice"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && approvedJobs.length > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-600">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, approvedJobs.length)} of {approvedJobs.length}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>

              <span className="px-3">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
