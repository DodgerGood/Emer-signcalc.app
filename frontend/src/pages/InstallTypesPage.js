import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Plus, Pencil, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function InstallTypesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const importFileRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    quantity_of_people: '2',
    rate_per_hour: '',
    sqm_per_hour: '',
    hire_machine_name: '',
    hire_machine_supplier: '',
    hire_machine_rate_per_hour: '',
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const res = await api.get('/install-types');
      setItems(res.data || []);
    } catch {
      toast.error('Failed to load installation types');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        quantity_of_people: Number(formData.quantity_of_people),
        rate_per_hour: Number(formData.rate_per_hour),
        sqm_per_hour: formData.sqm_per_hour ? Number(formData.sqm_per_hour) : null,
        hire_machine_name: formData.hire_machine_name || null,
        hire_machine_supplier: formData.hire_machine_supplier || null,
        hire_machine_rate_per_hour: formData.hire_machine_rate_per_hour
          ? Number(formData.hire_machine_rate_per_hour)
          : null,
      };

      if (editingId) {
        await api.put(`/install-types/${editingId}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/install-types', payload);
        toast.success('Created');
      }

      setDialogOpen(false);
      setEditingId(null);
      setFormData({
        name: '',
        quantity_of_people: '2',
        rate_per_hour: '',
        sqm_per_hour: '',
        hire_machine_name: '',
        hire_machine_supplier: '',
        hire_machine_rate_per_hour: '',
      });

      loadItems();
    } catch {
      toast.error('Save failed');
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      name: item.name || '',
      quantity_of_people: item.quantity_of_people?.toString() || '2',
      rate_per_hour: item.rate_per_hour?.toString() || '',
      sqm_per_hour: item.sqm_per_hour?.toString() || '',
      hire_machine_name: item.hire_machine_name || '',
      hire_machine_supplier: item.hire_machine_supplier || '',
      hire_machine_rate_per_hour:
        item.hire_machine_rate_per_hour?.toString() || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this installation type?')) return;

    try {
      await api.delete(`/install-types/${id}`);
      toast.success('Deleted');
      loadItems();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black">Installation Pricelist</h1>
            <p className="text-slate-600 mt-2">
              Manage installation rates and equipment
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => importFileRef.current?.click()}
            >
              Import CSV
            </Button>

            <Button
              variant="outline"
              onClick={async () => {
                const res = await api.get('/install-types/export', {
                  responseType: 'blob',
                });
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'install_types.csv');
                document.body.appendChild(link);
                link.click();
              }}
            >
              Export CSV
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]">
                  <Plus size={16} className="mr-2" />
                  Add Installation Type
                </Button>
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Edit Installation Type' : 'Add Installation Type'}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    placeholder="Name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />

                  <Input
                    type="number"
                    placeholder="People"
                    value={formData.quantity_of_people}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity_of_people: e.target.value,
                      })
                    }
                  />

                  <Input
                    type="number"
                    placeholder="Rate per hour"
                    value={formData.rate_per_hour}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rate_per_hour: e.target.value,
                      })
                    }
                  />

                  <div className="flex gap-2">
                    <Button type="submit">
                      {editingId ? 'Update' : 'Create'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            <input
              ref={importFileRef}
              type="file"
              className="hidden"
              onChange={() => {}}
            />
          </div>
        </div>

        <Input
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {loading ? (
          <div>Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>People</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.rate_per_hour}</TableCell>
                  <TableCell>{item.quantity_of_people}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" onClick={() => handleEdit(item)}>
                      <Pencil size={16} />
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Layout>
  );
}
