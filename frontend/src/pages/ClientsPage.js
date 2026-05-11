import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ActionIconButton from '../components/ActionIconButton';

import { Plus, Pencil, Trash2, Info, FileText, Upload, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = () => ({
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  billing_address: '',
  site_address: '',
  vat_number: '',
  notes: '',
});

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [infoClient, setInfoClient] = useState(null);
  const [statementClient, setStatementClient] = useState(null);
  const [statementRows, setStatementRows] = useState([]);
  const [statementTotal, setStatementTotal] = useState(0);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementPage, setStatementPage] = useState(1);

  const statementItemsPerPage = 10;

  const [formData, setFormData] = useState(emptyForm());
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;
  const importFileRef = useRef(null);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/clients');
      setClients(response.data || []);
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyForm());
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (client) => {
    setEditingId(client.id);
    setFormData({
      company_name: client.company_name || '',
      contact_person: client.contact_person || '',
      email: client.email || '',
      phone: client.phone || '',
      billing_address: client.billing_address || '',
      site_address: client.site_address || '',
      vat_number: client.vat_number || '',
      notes: client.notes || '',
    });
    setDialogOpen(true);
  };

  const openStatement = async (client) => {
    setStatementClient(client);
    setStatementPage(1);
    setStatementLoading(true);

    try {
      const response = await api.get(`/clients/${client.id}/statement`);
      const rows = response.data?.rows || [];
      rows.sort((a, b) => new Date(b.invoice_date || 0) - new Date(a.invoice_date || 0));
      setStatementRows(rows);
      setStatementTotal(response.data?.unpaid_total || 0);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load statement');
    } finally {
      setStatementLoading(false);
    }
  };

  const reloadStatement = async () => {
    if (!statementClient) return;
    await openStatement(statementClient);
  };

  const downloadStatement = async () => {
    if (!statementClient) return;

    try {
      const response = await api.get(`/clients/${statementClient.id}/statement/pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${statementClient.company_name || 'client'}-statement.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download statement');
    }
  };

  const togglePaid = async (row) => {
    if (!statementClient) return;

    const paid = row.payment_status !== 'PAID';

    try {
      await api.post(`/clients/${statementClient.id}/statement/${row.id}/payment`, { paid });
      toast.success(paid ? 'Invoice marked paid' : 'Invoice marked unpaid');
      reloadStatement();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update payment');
    }
  };

  const loadPo = async (row) => {
    if (!statementClient) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.png,.jpg,.jpeg';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);

      try {
        await api.post(`/clients/${statementClient.id}/statement/${row.id}/po`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('P.O. loaded');
        reloadStatement();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Failed to load P.O.');
      }
    };

    input.click();
  };

  const createCredit = async (row) => {
    if (!statementClient) return;

    const amountText = window.prompt('Credit amount:', row.balance_amount || row.total_amount || 0);
    if (amountText === null) return;

    const reason = window.prompt('Credit reason:', 'Credit note') || '';
    const creditAmount = Number(amountText);

    if (Number.isNaN(creditAmount) || creditAmount < 0) {
      toast.error('Invalid credit amount');
      return;
    }

    try {
      await api.post(`/clients/${statementClient.id}/statement/${row.id}/credit`, {
        credit_amount: creditAmount,
        reason,
      });
      toast.success('Credit note recorded');
      reloadStatement();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create credit note');
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.company_name.trim()) {
      toast.error('Company name is required');
      return;
    }

    try {
      const payload = {
        company_name: formData.company_name.trim(),
        contact_person: formData.contact_person || null,
        email: formData.email || null,
        phone: formData.phone || null,
        billing_address: formData.billing_address || null,
        site_address: formData.site_address || null,
        vat_number: formData.vat_number || null,
        notes: formData.notes || null,
      };

      if (editingId) {
        await api.put(`/clients/${editingId}`, payload);
        toast.success('Client updated');
      } else {
        await api.post('/clients', payload);
        toast.success('Client saved');
      }

      setDialogOpen(false);
      resetForm();
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save client');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this client record?')) return;

    try {
      await api.delete(`/clients/${id}`);
      toast.success('Client deleted');
      loadClients();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleExportClients = () => {
    const headers = [
      'company_name',
      'contact_person',
      'email',
      'phone',
      'billing_address',
      'site_address',
      'vat_number',
      'notes',
    ];

    const rows = clients.map((client) =>
      headers.map((key) => {
        const value = client[key] || '';
        return `"${String(value).replaceAll('"', '""')}"`;
      }).join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'clients_export.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
    toast.success('Clients exported');
  };

  const handleImportClients = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);

    if (lines.length < 2) {
      toast.error('CSV has no client rows');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim());

    const parseRow = (row) => {
      const values = row.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const item = {};

      headers.forEach((header, index) => {
        item[header] = (values[index] || '')
          .replace(/^"/, '')
          .replace(/"$/, '')
          .replaceAll('""', '"')
          .trim();
      });

      return item;
    };

    try {
      let imported = 0;

      for (const row of lines.slice(1)) {
        const client = parseRow(row);

        if (!client.company_name) continue;

        await api.post('/clients', {
          company_name: client.company_name,
          contact_person: client.contact_person || null,
          email: client.email || null,
          phone: client.phone || null,
          billing_address: client.billing_address || null,
          site_address: client.site_address || null,
          vat_number: client.vat_number || null,
          notes: client.notes || null,
        });

        imported += 1;
      }

      toast.success(`Imported ${imported} clients`);
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Client import failed');
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase();

    return (
      client.company_name?.toLowerCase().includes(term) ||
      client.contact_person?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.phone?.toLowerCase().includes(term) ||
      client.vat_number?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

  const statementTotalPages = Math.max(1, Math.ceil(statementRows.length / statementItemsPerPage));
  const statementStartIndex = (statementPage - 1) * statementItemsPerPage;
  const paginatedStatementRows = statementRows.slice(
    statementStartIndex,
    statementStartIndex + statementItemsPerPage
  );

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Clients</h1>
            <p className="text-slate-600 mt-2">
              Manage client company details for quick estimating and quoting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportClients}
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => importFileRef.current?.click()}
              className="border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              Import CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportClients}
            >
              Export CSV
            </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                onClick={handleOpenCreate}
                className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
              >
                <Plus size={18} className="mr-2" />
                Add Client
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Client' : 'Add New Client'}</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="e.g., ABC Retailers"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      placeholder="Contact person"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="client@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+27..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>VAT Number</Label>
                    <Input
                      value={formData.vat_number}
                      onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                      placeholder="VAT number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Billing Address</Label>
                    <Textarea
                      value={formData.billing_address}
                      onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                      placeholder="Billing address"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Site / Delivery Address</Label>
                    <Textarea
                      value={formData.site_address}
                      onChange={(e) => setFormData({ ...formData, site_address: e.target.value })}
                      placeholder="Site or delivery address"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Client notes"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="bg-[#2563EB] hover:bg-[#1e40af]">
                    {editingId ? 'Update Client' : 'Save Client'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="w-full md:max-w-sm space-y-2">
          <Label>Search Clients</Label>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search company, contact, email, phone, VAT"
          />
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <Table className="w-full min-w-[1000px] text-sm">
                <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <TableRow>
                    <TableHead className="px-4 py-3">Company</TableHead>
                    <TableHead className="px-4 py-3">Contact</TableHead>
                    <TableHead className="px-4 py-3">Email</TableHead>
                    <TableHead className="px-4 py-3">Phone</TableHead>
                    <TableHead className="px-4 py-3">VAT No.</TableHead>
                    <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y">
                  {paginatedClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        No clients found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="px-4 py-3 font-semibold">{client.company_name}</TableCell>
                        <TableCell className="px-4 py-3">{client.contact_person || '-'}</TableCell>
                        <TableCell className="px-4 py-3">{client.email || '-'}</TableCell>
                        <TableCell className="px-4 py-3">{client.phone || '-'}</TableCell>
                        <TableCell className="px-4 py-3">{client.vat_number || '-'}</TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex justify-end gap-3 items-start">
                            <ActionIconButton
                              icon={<FileText size={16} />}
                              label="Statement"
                              tone="pdf"
                              variant="outline"
                              onClick={() => openStatement(client)}
                            />

                            <ActionIconButton
                              icon={<Info size={16} />}
                              label="Info"
                              tone="info"
                              onClick={() => setInfoClient(client)}
                            />

                            <ActionIconButton
                              icon={<Pencil size={16} />}
                              label="Edit"
                              tone="edit"
                              onClick={() => handleEdit(client)}
                            />

                            <ActionIconButton
                              icon={<Trash2 size={16} />}
                              label="Delete"
                              tone="delete"
                              onClick={() => handleDelete(client.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {filteredClients.length === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredClients.length)} of {filteredClients.length} clients
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>

                <span>Page {currentPage} of {totalPages}</span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}


        <Dialog open={!!statementClient} onOpenChange={(open) => !open && setStatementClient(null)}>
          <DialogContent className="w-[98vw] max-w-[98vw] md:max-w-6xl max-h-[92vh] overflow-y-auto p-3 md:p-6">
            <DialogHeader>
              <DialogTitle>
                Client Statement - {statementClient?.company_name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-slate-600">
                  Showing latest 20 invoices. Statement PDF includes unpaid invoices only.
                </div>

                <Button type="button" onClick={downloadStatement} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <FileText size={16} className="mr-2" />
                  Send Statement
                </Button>
              </div>

              {statementLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border bg-white">
                  <Table className="w-full text-xs md:text-sm">
                    <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <TableRow>
                        <TableHead className="px-4 py-3">Invoice #</TableHead>
                        <TableHead className="px-4 py-3">Invoice Date</TableHead>
                        <TableHead className="px-4 py-3 text-right">Total</TableHead>
                        <TableHead className="px-4 py-3 text-right">Credit</TableHead>
                        <TableHead className="px-4 py-3 text-right">Balance</TableHead>
                        <TableHead className="px-4 py-3">Status</TableHead>
                        <TableHead className="px-4 py-3">P.O.</TableHead>
                        <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody className="divide-y">
                      {statementRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                            No invoices found for this client.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedStatementRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="px-4 py-3 font-mono font-semibold">{row.invoice_number}</TableCell>
                            <TableCell className="px-4 py-3">
                              {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">R {(Number(row.total_amount) || 0).toFixed(2)}</TableCell>
                            <TableCell className="px-4 py-3 text-right">R {(Number(row.credit_amount) || 0).toFixed(2)}</TableCell>
                            <TableCell className="px-4 py-3 text-right font-bold">R {(Number(row.balance_amount) || 0).toFixed(2)}</TableCell>
                            <TableCell className="px-4 py-3">
                              <span className={row.payment_status === 'PAID' ? 'rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700' : 'rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700'}>
                                {row.payment_status || 'UNPAID'}
                              </span>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <div className="flex flex-col items-center gap-1">
                                <Button type="button" variant="outline" size="sm" onClick={() => loadPo(row)}>
                                  <Upload size={16} className="mr-2" />
                                  {row.po_uploaded ? 'Replace P.O.' : 'Load P.O.'}
                                </Button>
                                <span className="text-[10px] text-slate-400">P.O.</span>
                              </div>
                              {row.po_filename && (
                                <div className="mt-1 text-xs text-slate-500">{row.po_filename}</div>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-3 items-start">
                                <ActionIconButton
                                  icon={row.payment_status === 'PAID' ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                  label={row.payment_status === 'PAID' ? 'Unpaid' : 'Paid'}
                                  tone={row.payment_status === 'PAID' ? 'return' : 'approve'}
                                  onClick={() => togglePaid(row)}
                                  title={row.payment_status === 'PAID' ? 'Mark unpaid' : 'Mark paid'}
                                />

                                <ActionIconButton
                                  icon={<CreditCard size={16} />}
                                  label="Credit"
                                  tone="credit"
                                  onClick={() => createCredit(row)}
                                  title="Credit note"
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

              {statementRows.length > 0 && (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-600">
                  <div>
                    Showing {statementStartIndex + 1} to {Math.min(statementStartIndex + statementItemsPerPage, statementRows.length)} of {statementRows.length} invoices
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={statementPage === 1}
                      onClick={() => setStatementPage((page) => Math.max(1, page - 1))}
                    >
                      Previous
                    </Button>

                    <span>
                      Page {statementPage} of {statementTotalPages}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={statementPage === statementTotalPages}
                      onClick={() => setStatementPage((page) => Math.min(statementTotalPages, page + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              <div className="text-right text-lg font-black text-slate-900">
                Unpaid Total: R {(Number(statementTotal) || 0).toFixed(2)}
              </div>
            </div>
          </DialogContent>
        </Dialog>


        <Dialog open={!!infoClient} onOpenChange={(open) => !open && setInfoClient(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Client Info</DialogTitle>
            </DialogHeader>

            {infoClient && (
              <div className="space-y-2 text-sm">
                <div><strong>Company:</strong> {infoClient.company_name}</div>
                <div><strong>Contact:</strong> {infoClient.contact_person || '-'}</div>
                <div><strong>Email:</strong> {infoClient.email || '-'}</div>
                <div><strong>Phone:</strong> {infoClient.phone || '-'}</div>
                <div><strong>VAT No.:</strong> {infoClient.vat_number || '-'}</div>
                <div><strong>Billing Address:</strong> {infoClient.billing_address || '-'}</div>
                <div><strong>Site Address:</strong> {infoClient.site_address || '-'}</div>
                <div><strong>Notes:</strong> {infoClient.notes || '-'}</div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
