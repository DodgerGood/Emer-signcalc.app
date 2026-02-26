import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InkProfilesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', ink_type: 'UV', supplier: '', quantity_liters: '', price_per_unit: '', price_per_sqm_coverage: ''
  });

  const canEdit = user?.role === 'PROCUREMENT' || user?.role === 'CEO';

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const response = await api.get('/ink-profiles');
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load ink profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        ink_type: formData.ink_type,
        supplier: formData.supplier || null,
        quantity_liters: parseFloat(formData.quantity_liters),
        price_per_unit: parseFloat(formData.price_per_unit),
        price_per_sqm_coverage: parseFloat(formData.price_per_sqm_coverage)
      };

      if (editingId) {
        await api.put(`/ink-profiles/${editingId}`, data);
        toast.success('Ink profile updated');
      } else {
        await api.post('/ink-profiles', data);
        toast.success('Ink profile created');
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
      ink_type: item.ink_type,
      supplier: item.supplier || '',
      quantity_liters: item.quantity_liters.toString(),
      price_per_unit: item.price_per_unit.toString(),
      price_per_sqm_coverage: item.price_per_sqm_coverage.toString()
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ink profile?')) return;
    try {
      await api.delete(`/ink-profiles/${id}`);
      toast.success('Ink profile deleted');
      loadItems();
    } catch (error) {
      toast.error('Failed to delete ink profile');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', ink_type: 'UV', supplier: '', quantity_liters: '', price_per_unit: '', price_per_sqm_coverage: '' });
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Ink Profiles</h1>
            <p className="text-slate-600 mt-2">Manage ink profiles and costs (ZAR)</p>
          </div>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} data-testid="add-ink-profile-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                  <Plus size={18} className="mr-2" />Add Ink Profile
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingId ? 'Edit Ink Profile' : 'Add New Ink Profile'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Profile Name *</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="ink-name-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ink_type">Ink Type *</Label>
                    <Select value={formData.ink_type} onValueChange={(v) => setFormData({ ...formData, ink_type: v })}>
                      <SelectTrigger data-testid="ink-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UV">UV</SelectItem>
                        <SelectItem value="Solvent">Solvent</SelectItem>
                        <SelectItem value="Latex">Latex</SelectItem>
                        <SelectItem value="Eco-Solvent">Eco-Solvent</SelectItem>
                        <SelectItem value="Water-Based">Water-Based</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier</Label>
                    <Input id="supplier" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} data-testid="ink-supplier-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity_liters">Quantity (Liters) *</Label>
                    <Input id="quantity_liters" type="number" step="0.01" value={formData.quantity_liters} onChange={(e) => setFormData({ ...formData, quantity_liters: e.target.value })} required data-testid="ink-quantity-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price_per_unit">Price per Unit (ZAR) *</Label>
                    <Input id="price_per_unit" type="number" step="0.01" value={formData.price_per_unit} onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })} required data-testid="ink-price-unit-input" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price_per_sqm_coverage">Price per SqM Coverage (ZAR) *</Label>
                    <Input id="price_per_sqm_coverage" type="number" step="0.01" value={formData.price_per_sqm_coverage} onChange={(e) => setFormData({ ...formData, price_per_sqm_coverage: e.target.value })} required data-testid="ink-price-sqm-input" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" data-testid="ink-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">{editingId ? 'Update' : 'Create'}</Button>
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-md shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="data-mono">Quantity (L)</TableHead>
                  <TableHead className="data-mono">Price/Unit (ZAR)</TableHead>
                  <TableHead className="data-mono">Price/SqM (ZAR)</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={canEdit ? 7 : 6} className="text-center py-12 text-slate-500">No ink profiles yet. {canEdit && 'Create your first one!'}</TableCell></TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.ink_type}</TableCell>
                      <TableCell>{item.supplier || '-'}</TableCell>
                      <TableCell className="data-mono">{item.quantity_liters}L</TableCell>
                      <TableCell className="data-mono">R {item.price_per_unit.toFixed(2)}</TableCell>
                      <TableCell className="data-mono">R {item.price_per_sqm_coverage.toFixed(2)}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}><Pencil size={16} /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 size={16} /></Button>
                        </TableCell>
                      )}
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
