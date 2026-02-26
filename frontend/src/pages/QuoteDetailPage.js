import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [labourTypes, setLabourTypes] = useState([]);
  const [installTypes, setInstallTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [labourDialogOpen, setLabourDialogOpen] = useState(false);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [travelDialogOpen, setTravelDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    recipe_id: '',
    width_mm: '',
    height_mm: '',
    quantity: '1',
    markup_override: ''
  });
  const [labourFormData, setLabourFormData] = useState({
    labour_type_id: '',
    hours: '',
    notes: ''
  });
  const [installFormData, setInstallFormData] = useState({
    install_type_id: '',
    hours: '',
    notes: ''
  });
  const [travelFormData, setTravelFormData] = useState({
    rate_per_km: '',
    vehicle_type: '',
    toll_gates: '',
    subsistence: '',
    accommodation: ''
  });

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    try {
      const [quoteRes, recipesRes, labourRes, installRes] = await Promise.all([
        api.get(`/quotes/${id}`),
        api.get('/recipes'),
        api.get('/labour-types'),
        api.get('/install-types')
      ]);
      setQuote(quoteRes.data);
      setRecipes(recipesRes.data);
      setLabourTypes(labourRes.data);
      setInstallTypes(installRes.data);
    } catch (error) {
      toast.error('Failed to load quote');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLine = async (e) => {
    e.preventDefault();
    try {
      const data = {
        recipe_id: formData.recipe_id,
        width_mm: parseFloat(formData.width_mm),
        height_mm: parseFloat(formData.height_mm),
        quantity: parseInt(formData.quantity),
        markup_override: formData.markup_override ? parseFloat(formData.markup_override) : null
      };
      await api.post(`/quotes/${id}/lines`, data);
      toast.success('Line added to quote');
      setDialogOpen(false);
      setFormData({ recipe_id: '', width_mm: '', height_mm: '', quantity: '1', markup_override: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add line');
    }
  };

  const handleAddLabour = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/quotes/${id}/labour`, {
        labour_type_id: labourFormData.labour_type_id,
        hours: parseFloat(labourFormData.hours),
        notes: labourFormData.notes || null
      });
      toast.success('Labour added to quote');
      setLabourDialogOpen(false);
      setLabourFormData({ labour_type_id: '', hours: '', notes: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add labour');
    }
  };

  const handleDeleteLabour = async (labourId) => {
    if (!window.confirm('Delete this labour item?')) return;
    try {
      await api.delete(`/quotes/${id}/labour/${labourId}`);
      toast.success('Labour deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete labour');
    }
  };

  const handleAddInstallation = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/quotes/${id}/installation`, {
        install_type_id: installFormData.install_type_id,
        hours: parseFloat(installFormData.hours),
        notes: installFormData.notes || null
      });
      toast.success('Installation added to quote');
      setInstallDialogOpen(false);
      setInstallFormData({ install_type_id: '', hours: '', notes: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add installation');
    }
  };

  const handleDeleteInstallation = async (installId) => {
    if (!window.confirm('Delete this installation item?')) return;
    try {
      await api.delete(`/quotes/${id}/installation/${installId}`);
      toast.success('Installation deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete installation');
    }
  };

  const handleAddTravel = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/quotes/${id}/travel`, {
        rate_per_km: parseFloat(travelFormData.rate_per_km),
        vehicle_type: travelFormData.vehicle_type,
        toll_gates: parseFloat(travelFormData.toll_gates),
        subsistence: parseFloat(travelFormData.subsistence),
        accommodation: parseFloat(travelFormData.accommodation)
      });
      toast.success('Travel added to quote');
      setTravelDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add travel');
    }
  };

  const handleDeleteTravel = async () => {
    if (!window.confirm('Delete travel from quote?')) return;
    try {
      await api.delete(`/quotes/${id}/travel`);
      toast.success('Travel deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete travel');
    }
  };

  const handleConvertToJob = async () => {
    if (!window.confirm('Convert this quote to a job ticket?')) return;
    try {
      const response = await api.post(`/quotes/${id}/convert-to-job`);
      toast.success(`Job ticket created: ${response.data.job_ticket_number}`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to convert to job');
    }
  };

  const handleSubmitForApproval = async () => {
    if (!window.confirm('Submit this quote for manager approval?')) return;
    try {
      await api.post(`/quotes/${id}/submit-for-approval`);
      toast.success('Quote submitted for approval');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit for approval');
    }
  };

  const handleApproveQuote = async () => {
    if (!window.confirm('Approve this quote?')) return;
    try {
      await api.post(`/quotes/${id}/approve`);
      toast.success('Quote approved successfully');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve quote');
    }
  };

  const handleRejectQuote = async () => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/quotes/${id}/reject?rejection_reason=${encodeURIComponent(reason)}`);
      toast.success('Quote rejected');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject quote');
    }
  };



  const handleDeleteLine = async (lineId) => {
    if (!window.confirm('Delete this line?')) return;
    try {
      await api.delete(`/quotes/${id}/lines/${lineId}`);
      toast.success('Line deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete line');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await api.get(`/quotes/${id}/export/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quote_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('PDF downloaded');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleExportBOM = async () => {
    try {
      const response = await api.get(`/quotes/${id}/export/bom`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bom_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('BOM downloaded');
    } catch (error) {
      toast.error('Failed to export BOM');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>
      </Layout>
    );
  }

  if (!quote) {
    return (
      <Layout>
        <Card><CardContent className="py-12 text-center text-slate-500">Quote not found</CardContent></Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">{quote.client_name}</h1>
            <p className="text-slate-600 mt-2">{quote.description || 'Quote Details'}</p>
            <p className="text-sm text-slate-500 mt-1">Created by {quote.created_by_name}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExportPDF} data-testid="export-pdf-btn" variant="outline">
              <FileText size={18} className="mr-2" />Export PDF
            </Button>
            <Button onClick={handleExportBOM} data-testid="export-bom-btn" variant="outline">
              <Download size={18} className="mr-2" />Export BOM
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="card-technical">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Lines</p>
              <p className="text-2xl font-mono font-bold mt-1">{quote.lines.length}</p>
            </CardContent>
          </Card>
          <Card className="card-technical">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
              <p className="text-2xl font-bold mt-1">{quote.quote_status}</p>
            </CardContent>
          </Card>
          <Card className="card-technical">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Approval Status</p>
              <p className={`text-xl font-bold mt-1 ${
                quote.quote_approval_status === 'APPROVED' ? 'text-green-600' :
                quote.quote_approval_status === 'REJECTED' ? 'text-red-600' :
                'text-orange-600'
              }`}>
                {quote.quote_approval_status}
              </p>
              {quote.approved_by_name && (
                <p className="text-xs text-slate-500 mt-1">by {quote.approved_by_name}</p>
              )}
            </CardContent>
          </Card>
          <Card className="card-technical">
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Total Amount</p>
              <p className="text-3xl font-mono font-black mt-1 text-[#2563EB]">R {quote.total_amount.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Rejection Reason Alert */}
        {quote.quote_approval_status === 'REJECTED' && quote.rejection_reason && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="text-red-600 mt-1">⚠️</div>
                <div>
                  <p className="font-bold text-red-900">Quote Rejected</p>
                  <p className="text-sm text-red-700 mt-1">Reason: {quote.rejection_reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="card-technical">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Quote Lines</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-quote-line-btn" size="sm" className="bg-[#2563EB] hover:bg-[#1e40af]">
                  <Plus size={18} className="mr-2" />Add Line
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Quote Line</DialogTitle></DialogHeader>
                <form onSubmit={handleAddLine} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipe">Recipe *</Label>
                    <Select value={formData.recipe_id} onValueChange={(v) => setFormData({ ...formData, recipe_id: v })} required>
                      <SelectTrigger data-testid="quote-line-recipe-select"><SelectValue placeholder="Select recipe..." /></SelectTrigger>
                      <SelectContent>
                        {recipes.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="width">Width (mm) *</Label>
                      <Input id="width" type="number" step="0.1" value={formData.width_mm} onChange={(e) => setFormData({ ...formData, width_mm: e.target.value })} required data-testid="quote-line-width-input" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">Height (mm) *</Label>
                      <Input id="height" type="number" step="0.1" value={formData.height_mm} onChange={(e) => setFormData({ ...formData, height_mm: e.target.value })} required data-testid="quote-line-height-input" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input id="quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required data-testid="quote-line-quantity-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="markup">Markup Override (%)</Label>
                    <Input id="markup" type="number" step="0.1" value={formData.markup_override} onChange={(e) => setFormData({ ...formData, markup_override: e.target.value })} data-testid="quote-line-markup-input" placeholder="Leave blank for default" />
                    <p className="text-xs text-slate-500">Override may require manager approval</p>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" data-testid="quote-line-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">Add Line</Button>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {quote.lines.length === 0 ? (
              <div className="py-12 text-center text-slate-500">No lines yet. Add your first line item above.</div>
            ) : (
              <div className="space-y-6">
                {quote.lines.map((line, idx) => (
                  <div key={line.id} className="border border-slate-200 rounded-md p-4" data-testid={`quote-line-${line.id}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{line.recipe_name}</h3>
                        <p className="text-sm text-slate-600">
                          {line.width_mm}mm × {line.height_mm}mm | Qty: {line.quantity} | SqM: <span className="font-mono">{line.calculated_sqm}</span>
                        </p>
                        {line.approval_required && (
                          <p className="text-xs text-orange-600 mt-1">⚠️ Markup override requires approval ({line.approval_status})</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-slate-500 uppercase tracking-wider">Line Total</p>
                          <p className="text-2xl font-mono font-bold text-[#2563EB]">${line.total.toFixed(2)}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteLine(line.id)} data-testid={`delete-line-${line.id}`} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-100">
                            <TableHead className="text-xs">Item</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs data-mono">Qty</TableHead>
                            <TableHead className="text-xs data-mono">Unit Cost</TableHead>
                            <TableHead className="text-xs data-mono">Line Cost</TableHead>
                            <TableHead className="text-xs data-mono">Markup</TableHead>
                            <TableHead className="text-xs data-mono text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {line.line_items.map((item, itemIdx) => (
                            <TableRow key={itemIdx}>
                              <TableCell className="text-sm font-medium">{item.name}</TableCell>
                              <TableCell className="text-xs text-slate-500">{item.type}</TableCell>
                              <TableCell className="text-sm data-mono">{item.quantity}</TableCell>
                              <TableCell className="text-sm data-mono">${item.unit_cost.toFixed(2)}</TableCell>
                              <TableCell className="text-sm data-mono">${item.line_cost.toFixed(2)}</TableCell>
                              <TableCell className="text-sm data-mono">{item.markup_allowed ? `${item.markup_percent}%` : 'N/A'}</TableCell>
                              <TableCell className="text-sm data-mono text-right font-bold">${item.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Labour Section */}
        <Card className="card-technical">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Labour</CardTitle>
            <Dialog open={labourDialogOpen} onOpenChange={setLabourDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-labour-btn" size="sm" className="bg-[#2563EB] hover:bg-[#1e40af]">
                  <Plus size={18} className="mr-2" />Add Labour
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Labour to Quote</DialogTitle></DialogHeader>
                <form onSubmit={handleAddLabour} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="labour_type">Labour Type *</Label>
                    <Select value={labourFormData.labour_type_id} onValueChange={(v) => setLabourFormData({ ...labourFormData, labour_type_id: v })} required>
                      <SelectTrigger data-testid="labour-type-select"><SelectValue placeholder="Select labour type..." /></SelectTrigger>
                      <SelectContent>
                        {labourTypes.map(l => <SelectItem key={l.id} value={l.id}>{l.name} (R{l.rate_per_hour}/hr × {l.number_of_people} people)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="labour_hours">Hours *</Label>
                    <Input id="labour_hours" type="number" step="0.1" value={labourFormData.hours} onChange={(e) => setLabourFormData({ ...labourFormData, hours: e.target.value })} required data-testid="labour-hours-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="labour_notes">Notes</Label>
                    <Input id="labour_notes" value={labourFormData.notes} onChange={(e) => setLabourFormData({ ...labourFormData, notes: e.target.value })} data-testid="labour-notes-input" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" data-testid="labour-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">Add Labour</Button>
                    <Button type="button" variant="outline" onClick={() => setLabourDialogOpen(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {!quote.labour_items || quote.labour_items.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">No labour items. Add labour to quote.</div>
            ) : (
              <div className="space-y-3">
                {quote.labour_items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                    <div>
                      <p className="font-medium">{item.labour_type_name}</p>
                      <p className="text-sm text-slate-600">{item.number_of_people} people × R{item.rate_per_hour}/hr × {item.hours}hrs</p>
                      {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-mono font-bold">R {item.total_cost.toFixed(2)}</p>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteLabour(item.id)} className="text-red-600"><Trash2 size={16} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Installation Section */}
        <Card className="card-technical">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Installation</CardTitle>
            <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="add-installation-btn" size="sm" className="bg-[#2563EB] hover:bg-[#1e40af]">
                  <Plus size={18} className="mr-2" />Add Installation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Installation to Quote</DialogTitle></DialogHeader>
                <form onSubmit={handleAddInstallation} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="install_type">Installation Type *</Label>
                    <Select value={installFormData.install_type_id} onValueChange={(v) => setInstallFormData({ ...installFormData, install_type_id: v })} required>
                      <SelectTrigger data-testid="install-type-select"><SelectValue placeholder="Select installation type..." /></SelectTrigger>
                      <SelectContent>
                        {installTypes.map(i => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity_of_people} people @ R{i.rate_per_hour}/hr + R{i.equipment_rate} equip)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="install_hours">Hours *</Label>
                    <Input id="install_hours" type="number" step="0.1" value={installFormData.hours} onChange={(e) => setInstallFormData({ ...installFormData, hours: e.target.value })} required data-testid="install-hours-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="install_notes">Notes</Label>
                    <Input id="install_notes" value={installFormData.notes} onChange={(e) => setInstallFormData({ ...installFormData, notes: e.target.value })} data-testid="install-notes-input" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" data-testid="install-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">Add Installation</Button>
                    <Button type="button" variant="outline" onClick={() => setInstallDialogOpen(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {!quote.installation_items || quote.installation_items.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">No installation items. Add installation to quote.</div>
            ) : (
              <div className="space-y-3">
                {quote.installation_items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                    <div>
                      <p className="font-medium">{item.install_type_name}</p>
                      <p className="text-sm text-slate-600">{item.quantity_of_people} people × R{item.rate_per_hour}/hr × {item.hours}hrs + R{item.equipment_rate} equipment</p>
                      {item.notes && <p className="text-xs text-slate-500 mt-1">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xl font-mono font-bold">R {item.total_cost.toFixed(2)}</p>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteInstallation(item.id)} className="text-red-600"><Trash2 size={16} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Travel Section */}
        <Card className="card-technical">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Travel</CardTitle>
            {!quote.travel ? (
              <Dialog open={travelDialogOpen} onOpenChange={setTravelDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="add-travel-btn" size="sm" className="bg-[#2563EB] hover:bg-[#1e40af]">
                    <Plus size={18} className="mr-2" />Add Travel
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Travel to Quote</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddTravel} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="rate_per_km">Rate per KM (ZAR) *</Label>
                        <Input id="rate_per_km" type="number" step="0.01" value={travelFormData.rate_per_km} onChange={(e) => setTravelFormData({ ...travelFormData, rate_per_km: e.target.value })} required data-testid="travel-rate-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="vehicle_type">Vehicle Type *</Label>
                        <Input id="vehicle_type" value={travelFormData.vehicle_type} onChange={(e) => setTravelFormData({ ...travelFormData, vehicle_type: e.target.value })} required data-testid="travel-vehicle-input" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="toll_gates">Toll Gates (ZAR) *</Label>
                        <Input id="toll_gates" type="number" step="0.01" value={travelFormData.toll_gates} onChange={(e) => setTravelFormData({ ...travelFormData, toll_gates: e.target.value })} required data-testid="travel-tolls-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="subsistence">Subsistence (ZAR) *</Label>
                        <Input id="subsistence" type="number" step="0.01" value={travelFormData.subsistence} onChange={(e) => setTravelFormData({ ...travelFormData, subsistence: e.target.value })} required data-testid="travel-subsistence-input" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accommodation">Accommodation (ZAR) *</Label>
                        <Input id="accommodation" type="number" step="0.01" value={travelFormData.accommodation} onChange={(e) => setTravelFormData({ ...travelFormData, accommodation: e.target.value })} required data-testid="travel-accommodation-input" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" data-testid="travel-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">Add Travel</Button>
                      <Button type="button" variant="outline" onClick={() => setTravelDialogOpen(false)}>Cancel</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleDeleteTravel} className="text-red-600">
                <Trash2 size={16} className="mr-2" />Remove
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!quote.travel ? (
              <div className="py-8 text-center text-slate-500 text-sm">No travel added. Add travel details to quote.</div>
            ) : (
              <div className="p-4 bg-slate-50 rounded border">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Vehicle</p>
                    <p className="font-medium">{quote.travel.vehicle_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Rate/KM</p>
                    <p className="font-mono">R {quote.travel.rate_per_km.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Tolls</p>
                    <p className="font-mono">R {quote.travel.toll_gates.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Subsistence</p>
                    <p className="font-mono">R {quote.travel.subsistence.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Accommodation</p>
                    <p className="font-mono">R {quote.travel.accommodation.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">Travel Total</p>
                    <p className="text-xl font-mono font-bold">R {(quote.travel.toll_gates + quote.travel.subsistence + quote.travel.accommodation).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Approval Workflow */}
        {quote.quote_status === 'DRAFT' && quote.quote_approval_status === 'PENDING' && (
          <Card className="card-technical bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">Ready for approval?</h3>
                  <p className="text-sm text-slate-600 mt-1">Submit this quote to a manager for approval</p>
                </div>
                <Button onClick={handleSubmitForApproval} data-testid="submit-for-approval-btn" className="bg-blue-600 hover:bg-blue-700">
                  Submit for Approval
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {quote.quote_status === 'SUBMITTED' && quote.quote_approval_status === 'PENDING' && (
          <Card className="card-technical bg-orange-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">Awaiting Manager Approval</h3>
                  <p className="text-sm text-slate-600 mt-1">This quote has been submitted and is pending approval</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleApproveQuote} data-testid="approve-quote-btn" className="bg-green-600 hover:bg-green-700">
                    Approve Quote
                  </Button>
                  <Button onClick={handleRejectQuote} data-testid="reject-quote-btn" variant="destructive">
                    Reject Quote
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Convert to Job Ticket Button */}
        {quote.quote_approval_status === 'APPROVED' && !quote.job_ticket_number && (
          <Card className="card-technical bg-green-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">Quote Approved! Ready to proceed?</h3>
                  <p className="text-sm text-slate-600 mt-1">Convert this approved quote to a job ticket to start production</p>
                </div>
                <Button onClick={handleConvertToJob} data-testid="convert-to-job-btn" className="bg-green-600 hover:bg-green-700">
                  Convert to Job Ticket
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {quote.job_ticket_number && (
          <Card className="card-technical bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">Job Ticket Created</h3>
                  <p className="text-sm text-slate-600 mt-1">Status: {quote.quote_status}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Job Ticket #</p>
                  <p className="text-2xl font-mono font-bold text-blue-600">{quote.job_ticket_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        <div className="flex justify-between items-center">
          <Button variant="outline" onClick={() => navigate('/quotes')} data-testid="back-to-quotes-btn">← Back to Quotes</Button>
          <div className="text-right">
            <p className="text-sm text-slate-500 uppercase tracking-wider">Grand Total</p>
            <p className="text-4xl font-mono font-black text-[#0F172A]">${quote.total_amount.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
