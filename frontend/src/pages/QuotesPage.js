import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Card, CardContent } from '../components/ui/card';
import { Plus, Eye, Trash2, Calculator, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function QuotesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    description: ''
  });

  const isQuotingStaff = user?.role === 'QUOTING_STAFF';

  useEffect(() => { loadQuotes(); }, []);

  const loadQuotes = async () => {
    try {
      const response = await api.get('/quotes');
      setQuotes(response.data);
    } catch (error) {
      toast.error('Failed to load quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/quotes', formData);
      toast.success('Quote created - opening Estimation Dashboard');
      setDialogOpen(false);
      setFormData({ client_name: '', client_email: '', client_phone: '', client_address: '', description: '' });
      // Navigate to Estimation Dashboard
      navigate(`/estimation/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create quote');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quote?')) return;
    try {
      await api.delete(`/quotes/${id}`);
      toast.success('Quote deleted');
      loadQuotes();
    } catch (error) {
      toast.error('Failed to delete quote');
    }
  };

  const handleOpenCreateQuote = () => {
    setDialogOpen(true);
  };

  const getStatusBadge = (quote) => {
    const status = quote.quote_status;
    const approvalStatus = quote.quote_approval_status;
    
    if (status === 'JOB_CREATED') {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">JOB CREATED</span>;
    }
    if (status === 'COMPLETED') {
      if (approvalStatus === 'APPROVED') {
        return <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">APPROVED</span>;
      }
      if (approvalStatus === 'REJECTED') {
        return <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">REJECTED</span>;
      }
      return <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">COMPLETED</span>;
    }
    if (status === 'SUBMITTED') {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">PENDING APPROVAL</span>;
    }
    return <span className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">DRAFT</span>;
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Quotes</h1>
            <p className="text-slate-600 mt-2">Manage client quotes and estimates</p>
          </div>
          {isQuotingStaff && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleOpenCreateQuote}
                  data-testid="new-quote-btn"
                  className="bg-[#2563EB] hover:bg-[#1e40af]"
                >
                  <Plus size={18} className="mr-2" />New Quote
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Quote</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Client Name *</Label>
                    <Input
                      id="client_name"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      required
                      data-testid="quote-client-input"
                      placeholder="e.g., ABC Retailers"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="client_email">Email</Label>
                      <Input
                        id="client_email"
                        type="email"
                        value={formData.client_email}
                        onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                        data-testid="quote-email-input"
                        placeholder="client@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client_phone">Phone</Label>
                      <Input
                        id="client_phone"
                        value={formData.client_phone}
                        onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                        data-testid="quote-phone-input"
                        placeholder="+27 XXX XXX XXXX"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_address">Address</Label>
                    <Input
                      id="client_address"
                      value={formData.client_address}
                      onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                      data-testid="quote-address-input"
                      placeholder="Client address"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Project Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      data-testid="quote-description-input"
                      placeholder="Brief description of the project..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" data-testid="quote-create-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                      <Calculator size={18} className="mr-2" />
                      Create & Start Estimating
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
          ) : quotes.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                  <div className="text-lg font-semibold text-slate-900">
                    No quotes created yet
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Quotes will appear here once your costing setup is in place and you start creating them.
                  </div>

                  {isQuotingStaff && (
                    <button
                      type="button"
                      onClick={handleOpenCreateQuote}
                      data-testid="add-quote-btn"
                      className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                    >
                      Create your first quote
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
          <div className="space-y-4">
            {quotes.map((quote) => {
              const signCount = quote.blueprint?.signs?.length || 0;
              const canEdit = isQuotingStaff && quote.created_by === user?.id && quote.quote_status === 'DRAFT';
              
              return (
                <Card key={quote.id} className="card-technical" data-testid={`quote-${quote.id}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold">{quote.client_name}</h3>
                          {getStatusBadge(quote)}
                        </div>
                        {quote.description && <p className="text-sm text-slate-600">{quote.description}</p>}
                        <div className="flex gap-6 mt-3">
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Created By</p>
                            <p className="text-sm font-medium">{quote.created_by_name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Signs</p>
                            <p className="text-sm font-mono">{signCount}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Total</p>
                            <p className="text-lg font-mono font-bold text-[#2563EB]">R {quote.total_amount.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">Created</p>
                            <p className="text-sm">{new Date(quote.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {canEdit ? (
                          <Link to={`/estimation/${quote.id}`}>
                            <Button data-testid={`edit-quote-${quote.id}`} className="bg-[#2563EB] hover:bg-[#1e40af]">
                              <Calculator size={18} className="mr-2" />Edit
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/estimation/${quote.id}`}>
                            <Button variant="outline" data-testid={`view-quote-${quote.id}`}>
                              <Eye size={18} className="mr-2" />View Blueprint
                            </Button>
                          </Link>
                        )}
                        <Link to={`/quotes/${quote.id}`}>
                          <Button variant="outline" data-testid={`detail-quote-${quote.id}`}>
                            <FileText size={18} className="mr-2" />Details
                          </Button>
                        </Link>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            onClick={() => handleDelete(quote.id)}
                            data-testid={`delete-quote-${quote.id}`}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={18} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
