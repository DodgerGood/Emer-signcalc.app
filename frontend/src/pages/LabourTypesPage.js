import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LabourTypesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', rate_per_hour: '', number_of_people: '1' });

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const response = await api.get('/labour-types');
      setItems(response.data);
    } catch (error) {
      toast.error('Failed to load labour types');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = { name: formData.name, rate_per_hour: parseFloat(formData.rate_per_hour), number_of_people: parseInt(formData.number_of_people) };
      if (editingId) {
        await api.put(`/labour-types/${editingId}`, data);
        toast.success('Labour type updated');
      } else {
        await api.post('/labour-types', data);
        toast.success('Labour type created');
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
    setFormData({ name: item.name, rate_per_hour: item.rate_per_hour.toString(), number_of_people: item.number_of_people.toString() });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this labour type?')) return;
    try {
      await api.delete(`/labour-types/${id}`);
      toast.success('Labour type deleted');
      loadItems();
    } catch (error) {
      toast.error('Failed to delete labour type');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ name: '', rate_per_hour: '', number_of_people: '1' });
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Labour Pricelist</h1>
            <p className="text-slate-600 mt-2">Manage labour rates (ZAR)</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} data-testid="add-labour-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                <Plus size={18} className="mr-2" />Add Labour Type
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? 'Edit Labour Type' : 'Add New Labour Type'}</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Labour Type *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="labour-name-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate per Hour (ZAR) *</Label>
                  <Input id="rate" type="number" step="0.01" value={formData.rate_per_hour} onChange={(e) => setFormData({ ...formData, rate_per_hour: e.target.value })} required data-testid="labour-rate-input" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number_of_people">Number of People *</Label>
                  <Input id="number_of_people" type="number" value={formData.number_of_people} onChange={(e) => setFormData({ ...formData, number_of_people: e.target.value })} required data-testid="labour-people-input" />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" data-testid="labour-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">{editingId ? 'Update' : 'Create'}</Button>
                  <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-md shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="data-mono">Rate/Hour (ZAR)</TableHead>
                  <TableHead className="data-mono">People</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">No labour types yet. Create your first one!</TableCell></TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="data-mono">R {item.rate_per_hour.toFixed(2)}</TableCell>
                      <TableCell className="data-mono">{item.number_of_people}</TableCell>
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
