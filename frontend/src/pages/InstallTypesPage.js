import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InstallTypesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', quantity_of_people: '2', rate_per_hour: '', tools_required: '', 
    equipment: '', equipment_supplier: '', equipment_rate: '0' 
  });

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const response = await api.get('/install-types');
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load install types');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        quantity_of_people: parseInt(formData.quantity_of_people),
        rate_per_hour: parseFloat(formData.rate_per_hour),
        tools_required: formData.tools_required || null,
        equipment: formData.equipment || null,
        equipment_supplier: formData.equipment_supplier || null,
        equipment_rate: parseFloat(formData.equipment_rate)
      };
      if (editingId) {
        await api.put(`/install-types/${editingId}`, data);
        toast.success('Install type updated');
      } else {
        await api.post('/install-types', data);
        toast.success('Install type created');
      }
      setDialogOpen(false);
      resetForm();
      loadItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({ 
      name: item.name, 
      quantity_of_people: item.quantity_of_people.toString(), 
      rate_per_hour: item.rate_per_hour.toString(), 
      tools_required: item.tools_required || '', 
      equipment: item.equipment || '', 
      equipment_supplier: item.equipment_supplier || '', 
      equipment_rate: item.equipment_rate.toString() 
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this install type?')) return;
    try {
      await api.delete(`/install-types/${id}`);
      toast.success('Install type deleted');
      loadItems();
    } catch (error) {
      toast.error('Failed to delete install type');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', quantity_of_people: '2', rate_per_hour: '', tools_required: '', equipment: '', equipment_supplier: '', equipment_rate: '0' });
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Installation Pricelist</h1>
            <p className="text-slate-600 mt-2">Manage installation types and pricing (ZAR)</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} data-testid="add-install-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                <Plus size={18} className="mr-2" />Add Install Type
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{editingId ? 'Edit Install Type' : 'Add New Install Type'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Install Type *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="install-name-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity_of_people">Quantity of People *</Label>
                    <Input id="quantity_of_people" type="number" value={formData.quantity_of_people} onChange={(e) => setFormData({ ...formData, quantity_of_people: e.target.value })} required data-testid="install-people-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate_per_hour">Rate per Hour (ZAR) *</Label>
                    <Input id="rate_per_hour" type="number" step="0.01" value={formData.rate_per_hour} onChange={(e) => setFormData({ ...formData, rate_per_hour: e.target.value })} required data-testid="install-rate-input" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tools_required">Tools Required</Label>
                  <Textarea id="tools_required" value={formData.tools_required} onChange={(e) => setFormData({ ...formData, tools_required: e.target.value })} data-testid="install-tools-input" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipment">Equipment</Label>
                  <Input id="equipment" value={formData.equipment} onChange={(e) => setFormData({ ...formData, equipment: e.target.value })} data-testid="install-equipment-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="equipment_supplier">Equipment Supplier</Label>
                    <Input id="equipment_supplier" value={formData.equipment_supplier} onChange={(e) => setFormData({ ...formData, equipment_supplier: e.target.value })} data-testid="install-supplier-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="equipment_rate">Equipment Rate (ZAR) *</Label>
                    <Input id="equipment_rate" type="number" step="0.01" value={formData.equipment_rate} onChange={(e) => setFormData({ ...formData, equipment_rate: e.target.value })} required data-testid="install-equip-rate-input" />
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" data-testid="install-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">{editingId ? 'Update' : 'Create'}</Button>
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="data-mono">People</TableHead>
                  <TableHead className="data-mono">Rate/Hour (ZAR)</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead className="data-mono">Equip. Rate (ZAR)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                        <div className="text-lg font-semibold text-slate-900">
                          No installation rates added yet
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                          Add your installation pricing so transport, crew time, and install work can be included in recipes and quotes.
                        </div>

                        <button
                          type="button"
                          onClick={() => setDialogOpen(true)}
                          data-testid="add-install-btn"
                          className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                        >
                          Add your first installation rate
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="data-mono">{item.quantity_of_people}</TableCell>
                      <TableCell className="data-mono">R {item.rate_per_hour.toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{item.equipment || '-'}</TableCell>
                      <TableCell className="data-mono">R {item.equipment_rate.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}><Pencil size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 size={16} /></Button>
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
