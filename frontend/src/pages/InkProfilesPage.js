import React, { useEffect, useRef, useState } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const importFileRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    name: '',
    ink_type: 'UV',
    supplier: '',
    quantity_liters: '',
    price_per_unit: '',
    price_per_sqm_coverage: ''
  });

const canEdit =
  user?.role === 'PROCUREMENT' ||
  user?.role === 'CEO' ||
  user?.role === 'MD_ADMIN';

  useEffect(() => { loadItems(); }, []);

  useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm, typeFilter]);

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

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      typeFilter === 'ALL' || item.ink_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const handleExportInkProfiles = async () => {
    try {
      const response = await api.get('/ink-profiles/export', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ink_profiles_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Ink profiles export downloaded');
    } catch (error) {
      toast.error('Failed to export ink profiles');
    }
  };

  const handleImportInkProfiles = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await api.post('/ink-profiles/import', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = response.data;

      toast.success(
        `Import complete: ${result.imported_count} added, ${result.updated_count} updated`
      );

      if (result.error_count > 0) {
        toast.error(`${result.error_count} row(s) had errors`);
        console.log('Ink profile import errors:', result.errors);
      }

      loadItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import ink profiles');
    } finally {
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
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

          <div className="flex items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportInkProfiles}
              data-testid="import-ink-profiles-file-input"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => importFileRef.current?.click()}
              data-testid="import-ink-profiles-btn"
              className="border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              Import Ink Profiles CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportInkProfiles}
              data-testid="export-ink-profiles-btn"
            >
              Export Ink Profiles CSV
            </Button>

            {canEdit && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={resetForm}
                    data-testid="add-ink-profile-btn"
                    className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                  >
                    <Plus size={18} className="mr-2" />
                    Add Ink Profile
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Ink Profile' : 'Add New Ink Profile'}</DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Profile Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        data-testid="ink-name-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ink_type">Ink Type *</Label>
                      <Select
                        value={formData.ink_type}
                        onValueChange={(v) => setFormData({ ...formData, ink_type: v })}
                      >
                        <SelectTrigger data-testid="ink-type-select">
                          <SelectValue />
                        </SelectTrigger>
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
                      <Input
                        id="supplier"
                        value={formData.supplier}
                        onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                        data-testid="ink-supplier-input"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="quantity_liters">Quantity (Liters) *</Label>
                        <Input
                          id="quantity_liters"
                          type="number"
                          step="0.01"
                          value={formData.quantity_liters}
                          onChange={(e) => setFormData({ ...formData, quantity_liters: e.target.value })}
                          required
                          data-testid="ink-quantity-input"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="price_per_unit">Price per Unit (ZAR) *</Label>
                        <Input
                          id="price_per_unit"
                          type="number"
                          step="0.01"
                          value={formData.price_per_unit}
                          onChange={(e) => setFormData({ ...formData, price_per_unit: e.target.value })}
                          required
                          data-testid="ink-price-unit-input"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="price_per_sqm_coverage">Price per SqM Coverage (ZAR) *</Label>
                        <Input
                          id="price_per_sqm_coverage"
                          type="number"
                          step="0.01"
                          value={formData.price_per_sqm_coverage}
                          onChange={(e) => setFormData({ ...formData, price_per_sqm_coverage: e.target.value })}
                          required
                          data-testid="ink-price-sqm-input"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        data-testid="ink-submit-btn"
                        className="bg-[#2563EB] hover:bg-[#1e40af]"
                      >
                        {editingId ? 'Update' : 'Create'}
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
            )}
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Use the exported CSV as your template. Matching names update existing ink profiles, new names are added.
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-sm space-y-2">
            <Label htmlFor="ink-search">Search Ink Profiles</Label>
            <Input
              id="ink-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or supplier"
              data-testid="ink-search-input"
            />
          </div>

          <div className="w-full md:w-56 space-y-2">
            <Label htmlFor="ink-type-filter">Ink Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger id="ink-type-filter" data-testid="ink-type-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Ink Types</SelectItem>
                <SelectItem value="UV">UV</SelectItem>
                <SelectItem value="Solvent">Solvent</SelectItem>
                <SelectItem value="Latex">Latex</SelectItem>
                <SelectItem value="Eco-Solvent">Eco-Solvent</SelectItem>
                <SelectItem value="Water-Based">Water-Based</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
        <>
            <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
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
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 7 : 6} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                          <div className="text-lg font-semibold text-slate-900">
                            No ink profiles found
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            Try adjusting your search or filter, or add a new ink profile.
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                resetForm();
                                setDialogOpen(true);
                              }}
                              data-testid="add-first-ink-profile-btn"
                              className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                            >
                              Add your first ink profile
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.ink_type}</TableCell>
                        <TableCell>{item.supplier || '-'}</TableCell>
                        <TableCell className="data-mono">{item.quantity_liters}L</TableCell>
                        <TableCell className="data-mono">R {item.price_per_unit.toFixed(2)}</TableCell>
                        <TableCell className="data-mono">R {item.price_per_sqm_coverage.toFixed(2)}</TableCell>

                        {canEdit && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} ink profiles
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

                <span>
                  Page {currentPage} of {totalPages}
                </span>

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
      </div>
    </Layout>
  );
}
