import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ActionIconButton from '../components/ActionIconButton';

import { FileText, Upload, Download, Trash2, RotateCcw, Factory } from 'lucide-react';
import { toast } from 'sonner';

function formatDisplayDate(value) {
  if (!value) return '-';

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-');
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('en-ZA');
}


export default function ApprovalsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canMoveBackToQuote = ['MD_ADMIN', 'MANAGER', 'CEO'].includes(user?.role);

  const [approvedJobs, setApprovedJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const itemsPerPage = 10;

  useEffect(() => {
    loadApprovedJobs();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  const downloadDeliveryNote = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/delivery-note/pdf`, {
        responseType: 'blob',
      });

      const clientName = (job.client_name || 'Client').replaceAll(' ', '_');
      const datePart = (job.invoice_created_at || job.created_at || '').slice(0, 10);
      const deliveryNoteNumber = (job.invoice_number || 'DN').replace('Inv', 'DN');
      downloadFile(response, `${deliveryNoteNumber}-${clientName}-${datePart}.pdf`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download delivery note');
    }
  };

  const downloadBom = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/bom/pdf`, {
        responseType: 'blob',
      });

      const clientName = (job.client_name || 'Client').replaceAll(' ', '_');
      downloadFile(response, `${job.invoice_number || 'Inv'}-${clientName}-BOM.pdf`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'BOM PDF is not ready yet');
    }
  };

  const uploadProof = async (job) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/png,image/jpeg,image/jpg';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('Design proof must be 5MB or smaller');
        return;
      }

      const formData = new FormData();
      formData.append('proof_file', file);

      try {
        await api.post(`/approved/${job.id}/design-proof`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        toast.success('Design proof uploaded');
        loadApprovedJobs();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to upload design proof');
      }
    };

    input.click();
  };

  const downloadProof = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/design-proof`, {
        responseType: 'blob',
      });

      const filename = job.design_proof_filename || 'design-proof';
      downloadFile(response, filename);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No design proof uploaded yet');
    }
  };

  const formatProofDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-ZA');
  };

  const formatDueDate = (value) => {
    if (!value) return '-';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10) || '-';
    return date.toLocaleDateString('en-ZA');
  };

  const uploadJobTicket = async (job) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/png,image/jpeg,image/jpg';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('Job ticket must be 5MB or smaller');
        return;
      }

      const formData = new FormData();
      formData.append('job_ticket_file', file);

      try {
        await api.post(`/approved/${job.id}/job-ticket`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        toast.success('Job ticket uploaded');
        loadApprovedJobs();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to upload job ticket');
      }
    };

    input.click();
  };

  const downloadJobTicket = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/job-ticket`, {
        responseType: 'blob',
      });

      const filename = job.job_ticket_document_filename || 'job-ticket';
      downloadFile(response, filename);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No job ticket uploaded yet');
    }
  };

  const trackProduction = async (job) => {
    try {
      if (job.production_posted) {
        if (!window.confirm(`Remove ${job.invoice_number || 'this job'} from production tracking?`)) return;

        await api.post(`/production/${job.id}/remove`);
        toast.success('Job removed from production');
        loadApprovedJobs();
        return;
      }

      await api.post(`/production/${job.id}/start`);
      toast.success('Job posted to production');
      navigate(`/production?jobId=${job.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update production tracking');
    }
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

  const filteredJobs = approvedJobs.filter((job) => {
    const term = searchTerm.toLowerCase();

    return (
      job.client_name?.toLowerCase().includes(term) ||
      job.invoice_number?.toLowerCase().includes(term) ||
      job.quote_number?.toLowerCase().includes(term) ||
      job.estimate_number?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Layout>
      <div className="space-y-6 fade-in w-full">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Approved</h1>
            <p className="text-slate-600 mt-2">
              Approved invoices, BOM documents, design proofs, job packs, and production handover.
            </p>
          </div>
        </div>

        <div className="w-full md:max-w-sm space-y-2">
          <label className="text-sm font-medium">Search Approved</label>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search client, invoice, or quote #"
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table className="w-full min-w-[1650px] text-sm">
              <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <TableRow>
                  <TableHead className="px-4 py-3">Client Name</TableHead>
                  <TableHead className="px-4 py-3 text-center">Due Date</TableHead>
                  <TableHead className="px-4 py-3 text-center">Invoice</TableHead>
                  <TableHead className="px-4 py-3 text-center">Delivery Note</TableHead>
                  <TableHead className="px-4 py-3 text-center">BOM</TableHead>
                  <TableHead className="px-4 py-3 text-center">Design Proof</TableHead>
                  <TableHead className="px-4 py-3 text-center">Job Ticket</TableHead>
                  <TableHead className="px-4 py-3 text-center">Production</TableHead>
                  <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y">
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12 text-center text-slate-500">
                      No approved invoices yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="px-4 py-3 font-semibold">
                        {job.client_name}
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center font-semibold text-amber-700">
                        {formatDueDate(job.due_date)}
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center">
                        <ActionIconButton
                          icon={<FileText size={16} />}
                          label={job.invoice_number || 'Invoice'}
                          tone="invoice"
                          variant="outline"
                          onClick={() => downloadInvoice(job)}
                          title="Download invoice PDF"
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center">
                        <ActionIconButton
                          icon={<FileText size={16} />}
                          label="Delivery"
                          tone="delivery"
                          variant="outline"
                          onClick={() => downloadDeliveryNote(job)}
                          title="Download delivery note PDF"
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center">
                        <ActionIconButton
                          icon={<FileText size={16} />}
                          label="BOM"
                          tone="bom"
                          variant="outline"
                          onClick={() => downloadBom(job)}
                          title="Download BOM PDF"
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center gap-2">
                            <ActionIconButton
                              icon={<Upload size={16} />}
                              label="Upload"
                              tone="proofUpload"
                              variant="outline"
                              onClick={() => uploadProof(job)}
                              title="Upload design proof"
                            />

                            <ActionIconButton
                              icon={<Download size={16} />}
                              label="Download"
                              tone="proofDownload"
                              variant="outline"
                              onClick={() => downloadProof(job)}
                              title="Download design proof"
                            />
                          </div>

                          {job.design_proof_filename ? (
                            <div className="max-w-[160px] text-center text-[11px] leading-tight text-slate-500">
                              <div className="truncate" title={job.design_proof_filename}>
                                {job.design_proof_filename}
                              </div>
                              <div>{formatProofDate(job.design_proof_uploaded_at)}</div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">No proof uploaded</div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center gap-2">
                            <ActionIconButton
                              icon={<Upload size={16} />}
                              label="Upload"
                              tone="ticketUpload"
                              variant="outline"
                              onClick={() => uploadJobTicket(job)}
                              title="Upload job ticket"
                            />

                            <ActionIconButton
                              icon={<Download size={16} />}
                              label="Download"
                              tone="ticketDownload"
                              variant="outline"
                              onClick={() => downloadJobTicket(job)}
                              title="Download job ticket"
                            />
                          </div>

                          {job.job_ticket_document_filename ? (
                            <div className="max-w-[160px] text-center text-[11px] leading-tight text-slate-500">
                              <div className="truncate" title={job.job_ticket_document_filename}>
                                {job.job_ticket_document_filename}
                              </div>
                              <div>{formatProofDate(job.job_ticket_document_uploaded_at)}</div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">No ticket uploaded</div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3 text-center">
                        <ActionIconButton
                          icon={
                            job.production_posted ? (
                              <span className="relative inline-flex h-5 w-5 items-center justify-center">
                                <Factory size={16} />
                                <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[10px] font-black leading-none text-white">
                                  ×
                                </span>
                              </span>
                            ) : (
                              <Factory size={16} />
                            )
                          }
                          label={job.production_posted ? "Remove from Production" : "Track"}
                          tone="production"
                          variant="outline"
                          onClick={() => trackProduction(job)}
                          title={job.production_posted ? "Remove from production" : "Track production"}
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3 items-start">
                          {canMoveBackToQuote && (
                            <ActionIconButton
                              icon={<RotateCcw size={16} />}
                              label="Return"
                              tone="return"
                              onClick={() => moveBackToQuote(job)}
                              title="Move back to quoting"
                            />
                          )}

                          <ActionIconButton
                            icon={<Trash2 size={16} />}
                            label="Delete"
                            tone="delete"
                            onClick={() => deleteApproved(job)}
                            title="Delete approved invoice"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && filteredJobs.length > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-600">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredJobs.length)} of {filteredJobs.length}
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
