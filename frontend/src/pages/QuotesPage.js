import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ActionIconButton from '../components/ActionIconButton';

import { Plus, Info, Pencil, Trash2, CheckCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

const money = (value) => `R ${(Number(value) || 0).toFixed(2)}`;

export default function QuotesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isEstimationsPage = location.pathname.startsWith('/estimations');

  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [infoQuote, setInfoQuote] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [staffFilter, setStaffFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    description: '',
  });

  const itemsPerPage = 10;
  const isQuotingStaff = user?.role === 'QUOTING_STAFF' || user?.role === 'MD_ADMIN';

  useEffect(() => {
    loadQuotes();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, staffFilter]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const [quotesRes, clientsRes] = await Promise.all([
        api.get('/quotes'),
        api.get('/clients'),
      ]);

      setQuotes(quotesRes.data || []);
      setClients(clientsRes.data || []);
    } catch {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const selectClient = (client) => {
    setFormData({
      ...formData,
      client_name: client.company_name || '',
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.billing_address || client.site_address || '',
      description: formData.description || client.notes || '',
    });
    setClientSearch(client.company_name || '');
  };

  const matchedClients = clients.filter((client) => {
    const term = clientSearch.toLowerCase();
    if (!term) return false;

    return (
      client.company_name?.toLowerCase().includes(term) ||
      client.contact_person?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.phone?.toLowerCase().includes(term)
    );
  }).slice(0, 5);

  const exactClientExists = clients.some(
    (client) => client.company_name?.trim().toLowerCase() === formData.client_name.trim().toLowerCase()
  );

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      if (formData.client_name.trim() && !exactClientExists) {
        await api.post('/clients', {
          company_name: formData.client_name.trim(),
          contact_person: null,
          email: formData.client_email || null,
          phone: formData.client_phone || null,
          billing_address: formData.client_address || null,
          site_address: null,
          vat_number: null,
          notes: formData.description || null,
        });
      }

      const response = await api.post('/quotes', formData);
      toast.success('Estimate created');

      setDialogOpen(false);
      setFormData({
        client_name: '',
        client_email: '',
        client_phone: '',
        client_address: '',
        description: '',
      });
      setClientSearch('');

      navigate(`/quotes/${response.data.id}`);
    } catch (error) {
      console.log('Create estimate error:', error.response?.data || error);
      const apiUrl = api.defaults?.baseURL || 'API URL not found';
      const token = localStorage.getItem('token');
      toast.error(
        `${error.response?.data?.detail || JSON.stringify(error.response?.data) || error.message || 'Failed to create estimate'} | API: ${apiUrl} | Token: ${token ? 'YES' : 'NO'}`
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quote permanently?')) return;

    try {
      await api.delete(`/quotes/${id}`);
      toast.success('Quote deleted');
      loadQuotes();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/quotes/${id}/approve`);
      toast.success('Quote approved');
      loadQuotes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Approval failed');
    }
  };

  const handleExportPdf = async (quote) => {
    try {
      const response = await api.get(`/quotes/${quote.id}/export/pdf`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const clientName = (quote.client_name || 'client').replaceAll(' ', '_');
      const datePart = (quote.created_at || '').slice(0, 10);
      link.setAttribute('download', `${quote.quote_number || 'quote'}-${clientName}-${datePart}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('PDF downloaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create PDF');
    }
  };


  const handleConvertToInvoice = async (quote) => {
    try {
      await api.post(`/quotes/${quote.id}/convert-to-invoice`);

      toast.success('Quote converted to invoice');
      loadQuotes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to convert invoice');
    }
  };

  
  const staffOptions = useMemo(() => {
    return [...new Set(quotes.map((q) => q.created_by_name).filter(Boolean))];
  }, [quotes]);

  const filteredQuotes = quotes.filter((quote) => {
    const displayNumber = (quote.quote_number || quote.estimate_number || '').toLowerCase();
    const term = searchTerm.toLowerCase();

    const belongsOnThisPage = isEstimationsPage
      ? !quote.quote_number
      : !!quote.quote_number && !quote.invoice_number && quote.quote_status !== 'INVOICED';

    const matchesSearch =
      displayNumber.includes(term) ||
      quote.client_name?.toLowerCase().includes(term) ||
      quote.description?.toLowerCase().includes(term);

    const matchesStaff =
      staffFilter === 'ALL' || quote.created_by_name === staffFilter;

    return belongsOnThisPage && matchesSearch && matchesStaff;
  });

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedQuotes = filteredQuotes.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">
              {isEstimationsPage ? 'Estimations' : 'Quotes'}
            </h1>
            <p className="text-slate-600 mt-2">
              {isEstimationsPage
                ? 'Create and manage internal estimates before converting them into client quotes.'
                : 'Manage client-facing quotes.'}
            </p>
          </div>

          {isEstimationsPage && isQuotingStaff && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  data-testid="new-quote-btn"
                  className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={18} className="mr-2" />
                  New Estimate
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Estimate</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Search / Select Client *</Label>
                    <Input
                      value={clientSearch}
                      onChange={(e) => {
                        setClientSearch(e.target.value);
                        setFormData({ ...formData, client_name: e.target.value });
                      }}
                      placeholder="Search existing client or type new client"
                      required
                    />

                    {matchedClients.length > 0 && (
                      <div className="rounded-md border bg-white shadow-sm">
                        {matchedClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => selectClient(client)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            <div className="font-semibold">{client.company_name}</div>
                            {(client.contact_person || client.email || client.phone) && (
                              <div className="text-xs text-slate-500">
                                {[client.contact_person, client.email, client.phone].filter(Boolean).join(' | ')}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {formData.client_name && !exactClientExists && matchedClients.length === 0 && (
                      <p className="text-xs text-blue-700">
                        New client will be saved to Clients when you create the estimate.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.client_email}
                        onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                        placeholder="client@example.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input
                        value={formData.client_phone}
                        onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                        placeholder="+27..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={formData.client_address}
                      onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                      placeholder="Client address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Project Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief project description..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="bg-[#2563EB] hover:bg-[#1e40af]">
                      Create & Estimate
                    </Button>

                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="w-full md:max-w-sm space-y-2">
            <Label>Search</Label>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by client, project, or quote #"
            />
          </div>

          <div className="w-full md:max-w-xs space-y-2">
            <Label>Quoting Staff</Label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="ALL">All Staff</option>
              {staffOptions.map((staff) => (
                <option key={staff} value={staff}>
                  {staff}
                </option>
              ))}
            </select>
          </div>
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
                    <TableHead className="px-4 py-3">{isEstimationsPage ? "Estimate #" : "Quote #"}</TableHead>
                    <TableHead className="px-4 py-3">Client</TableHead>
                    <TableHead className="px-4 py-3">Staff</TableHead>
                    <TableHead className="px-4 py-3">Total</TableHead>
                    <TableHead className="px-4 py-3">Date</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                    <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y">
                  {paginatedQuotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center">
                        No {isEstimationsPage ? 'estimates' : 'quotes'} found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedQuotes.map((quote, index) => {
                      const quoteNumber = quote.quote_number || quote.estimate_number;

                      return (
                        <TableRow key={quote.id}>
                          <TableCell className="px-4 py-3 font-mono"><div className="flex items-center gap-2">
        {isEstimationsPage ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleApprove(quote.id)}
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
            title="Approve and convert to quote"
          >
            <CheckCircle size={16} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleConvertToInvoice(quote)}
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
            title="Convert to invoice"
          >
            <CheckCircle size={16} />
          </Button>
        )}
        <span>{quoteNumber || '-'}</span>
      </div></TableCell>
                          <TableCell className="px-4 py-3 font-semibold">{quote.client_name}</TableCell>
                          <TableCell className="px-4 py-3">{quote.created_by_name}</TableCell>
                          <TableCell className="px-4 py-3 font-mono font-bold text-blue-700">
                            {money(quote.total_amount)}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {quote.created_at ? new Date(quote.created_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {quote.quote_status || 'DRAFT'}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex justify-end gap-3 items-start">
                              <ActionIconButton
                                icon={<Info size={16} />}
                                label="Info"
                                tone="info"
                                onClick={() => setInfoQuote({ ...quote, quoteNumber })}
                              />

                              <Link to={`/quotes/${quote.id}`}>
                                <ActionIconButton
                                  icon={<Pencil size={16} />}
                                  label="Edit"
                                  tone="edit"
                                />
                              </Link>

                              {isEstimationsPage ? (
                                <ActionIconButton
                                  icon={<CheckCircle size={16} />}
                                  label="Approve"
                                  tone="approve"
                                  onClick={() => handleApprove(quote.id)}
                                  title="Approve and convert to quote"
                                />
                              ) : (
                                <ActionIconButton
                                  icon={<CheckCircle size={16} />}
                                  label="Invoice"
                                  tone="approve"
                                  onClick={() => handleConvertToInvoice(quote)}
                                  title="Convert to invoice"
                                />
                              )}

                              {!isEstimationsPage && quote.quote_number && (
                                <ActionIconButton
                                  icon={<FileText size={16} />}
                                  label="PDF"
                                  tone="pdf"
                                  onClick={() => handleExportPdf(quote)}
                                  title="Create PDF"
                                />
                              )}

                              <ActionIconButton
                                icon={<Trash2 size={16} />}
                                label="Delete"
                                tone="delete"
                                onClick={() => handleDelete(quote.id)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {filteredQuotes.length === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredQuotes.length)} of {filteredQuotes.length}
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

        <Dialog open={!!infoQuote} onOpenChange={(open) => !open && setInfoQuote(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quote Info</DialogTitle>
            </DialogHeader>

            {infoQuote && (
              <div className="space-y-2 text-sm">
                <div><strong>Quote #:</strong> {infoQuote.quoteNumber || '-'}</div>
                <div><strong>Client:</strong> {infoQuote.client_name}</div>
                <div><strong>Total:</strong> {money(infoQuote.total_amount)}</div>
                <div><strong>Date:</strong> {infoQuote.created_at ? new Date(infoQuote.created_at).toLocaleDateString() : '-'}</div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
