import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ActionIconButton from '../components/ActionIconButton';

import { Plus, Pencil, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useCompanyCurrency, formatMoney } from '../lib/currency';

const parseLengthToMm = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const raw = value.toString().toLowerCase().trim().replace(/\s+/g, '');
  const number = parseFloat(raw);

  if (Number.isNaN(number)) return null;

  if (raw.endsWith('mm')) return number;
  if (raw.endsWith('cm')) return number * 10;
  if (raw.endsWith('m')) return number * 1000;

  return number;
};

const parseVolumeToLiters = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const raw = value.toString().toLowerCase().trim().replace(/\s+/g, '');
  const number = parseFloat(raw);

  if (Number.isNaN(number)) return null;

  if (raw.endsWith('ml')) return number / 1000;
  if (raw.endsWith('cc')) return number / 1000;
  if (raw.endsWith('l')) return number;

  return number;
};

const emptyForm = () => ({
  name: '',
  material_type: 'SHEET',
  width: '',
  height: '',
  thickness: '',
  length_mm: '',
  sqm_price: '',
  unit_price: '',
  quantity_per_unit: '',
  supplier: '',
  material_grade: '',
  product_specs: '',
  waste_default_percent: '10',
  volume_liters: '',
  cc_per_sqm: '',
});

export default function MaterialsPage() {
  const currency = useCompanyCurrency();
  const money = (value) => formatMoney(value, currency);

  const { user } = useAuth();

  const canEdit =
    user?.role === 'PROCUREMENT' ||
    user?.role === 'CEO' ||
    user?.role === 'MD_ADMIN';

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  const importFileRef = useRef(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadMaterials();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await api.get('/materials');
      setMaterials(response.data || []);
    } catch {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyForm());
  };

  const handleOpenCreateMaterial = () => {
    resetForm();
    setDialogOpen(true);
  };

  const filteredMaterials = materials.filter((material) => {
    const term = searchTerm.toLowerCase();

    const matchesSearch =
      material.name?.toLowerCase().includes(term) ||
      material.supplier?.toLowerCase().includes(term) ||
      material.material_grade?.toLowerCase().includes(term);

    const matchesCategory =
      categoryFilter === 'ALL' || material.material_type === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMaterials.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMaterials = filteredMaterials.slice(startIndex, startIndex + itemsPerPage);

  const handleExportMaterials = async () => {
    try {
      const response = await api.get('/materials/export', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', 'materials_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      toast.success('Materials export downloaded');
    } catch {
      toast.error('Failed to export materials');
    }
  };

  const handleImportMaterials = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await api.post('/materials/import', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result = response.data;

      toast.success(
        `Import complete: ${result.imported_count} added, ${result.updated_count} updated`
      );

      if (result.error_count > 0) {
        toast.error(`${result.error_count} row(s) had errors`);
        console.log('Material import errors:', result.errors);
      }

      loadMaterials();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import materials');
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const width = parseLengthToMm(formData.width);
      const height = parseLengthToMm(formData.height);
      const thickness = parseLengthToMm(formData.thickness);
      const length_mm = parseLengthToMm(formData.length_mm);

      let sqm_price = formData.sqm_price ? parseFloat(formData.sqm_price) : null;
      const unit_price = formData.unit_price ? parseFloat(formData.unit_price) : null;
      const quantity_per_unit = formData.quantity_per_unit ? parseFloat(formData.quantity_per_unit) : null;
      const volume_liters = parseVolumeToLiters(formData.volume_liters);
      const cc_per_sqm = formData.cc_per_sqm ? parseFloat(formData.cc_per_sqm) : null;
      const waste_default_percent = parseFloat(formData.waste_default_percent || '0');

      let total_sqm = null;

      if (
        formData.material_type !== 'UNIT' &&
        formData.material_type !== 'INK' &&
        formData.material_type !== 'PROFILE' &&
        width !== null &&
        height !== null
      ) {
        total_sqm = (width * height) / 1000000;
      }

      if (
        ['SHEET', 'ROLL', 'BOARD'].includes(formData.material_type) &&
        unit_price !== null &&
        total_sqm !== null &&
        total_sqm > 0
      ) {
        sqm_price = unit_price / total_sqm;
      }

      if (
        formData.material_type === 'INK' &&
        unit_price !== null &&
        volume_liters !== null &&
        cc_per_sqm !== null &&
        volume_liters > 0
      ) {
        sqm_price = (unit_price / (volume_liters * 1000)) * cc_per_sqm;
      }

      if (
        formData.material_type === 'PROFILE' &&
        unit_price !== null &&
        length_mm !== null &&
        length_mm > 0
      ) {
        sqm_price = unit_price / (length_mm / 1000);
      }

      const data = {
        name: formData.name,
        material_type: formData.material_type,
        width,
        height,
        total_sqm,
        thickness,
        length_mm,
        sqm_price,
        unit_price,
        quantity_per_unit,
        supplier: formData.supplier || null,
        material_grade: formData.material_grade || null,
        product_specs: formData.product_specs || null,
        volume_liters,
        cc_per_sqm,
        waste_default_percent,
      };

      if (editingId) {
        await api.put(`/materials/${editingId}`, data);
        toast.success('Material updated');
      } else {
        await api.post('/materials', data);
        toast.success('Material created');
      }

      setDialogOpen(false);
      resetForm();
      loadMaterials();
    } catch (error) {
      console.log('Material save error:', error.response?.data || error);
      toast.error(
        error.response?.data?.detail ||
        JSON.stringify(error.response?.data) ||
        error.message ||
        'Operation failed'
      );
    }
  };

  const handleEdit = (material) => {
    if (
      !window.confirm(
        'Editing this item will affect the costing of every recipe where it is used. Click OK to continue.'
      )
    ) return;

    setEditingId(material.id);
    setFormData({
      name: material.name || '',
      material_type: material.material_type || 'SHEET',
      width: material.width?.toString() || '',
      height: material.height?.toString() || '',
      thickness: material.thickness?.toString() || '',
      length_mm: material.length_mm?.toString() || '',
      sqm_price: material.sqm_price?.toString() || '',
      unit_price: material.unit_price?.toString() || '',
      quantity_per_unit: material.quantity_per_unit?.toString() || '',
      supplier: material.supplier || '',
      material_grade: material.material_grade || '',
      product_specs: material.product_specs || '',
      waste_default_percent: material.waste_default_percent?.toString() || '10',
      volume_liters: material.volume_liters?.toString() || '',
      cc_per_sqm: material.cc_per_sqm?.toString() || '',
    });

    setDialogOpen(true);
  };

  const handleShowUsage = async (id) => {
    try {
      const response = await api.get(`/item-usage/${id}`);
      const recipes = response.data.used_in || [];

      if (recipes.length === 0) {
        alert('This item is not currently used in any recipes.');
        return;
      }

      alert(`This item is used in the following recipes:\n\n${recipes.join('\n')}`);
    } catch {
      toast.error('Failed to check recipe usage');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/materials/${id}`);
      toast.success('Material deleted');
      loadMaterials();
    } catch (err) {
      const data = err?.response?.data?.detail;

      if (data?.recipes) {
        alert(
          `This item cannot be deleted because it is used in the following recipes:\n\n${data.recipes.join('\n')}`
        );
      } else {
        toast.error('Delete failed');
      }
    }
  };

  const getDimensionLabels = () => {
    switch (formData.material_type) {
      case 'ROLL':
        return { width: 'Roll Width', height: 'Roll Length' };
      case 'SHEET':
        return { width: 'Sheet Width', height: 'Sheet Length' };
      case 'BOARD':
        return { width: 'Board Width', height: 'Board Length' };
      default:
        return { width: 'Width', height: 'Length' };
    }
  };

  const dimensionLabels = getDimensionLabels();

  const getCategoryHint = () => {
    switch (formData.material_type) {
      case 'SHEET':
        return 'Standard flat sheet material priced by total area.';
      case 'ROLL':
        return 'Flexible roll material priced by roll size and total area.';
      case 'BOARD':
        return 'Rigid board material priced by board size and total area.';
      case 'UNIT':
        return 'Pack or unit item priced by quantity.';
      case 'INK':
        return 'Ink, paint, or liquid priced from container cost, volume, and coverage.';
      case 'PROFILE':
        return 'Profile or structural item priced by length.';
      default:
        return 'Choose the material category that best matches how this item is purchased.';
    }
  };

  const getDisplayCategory = (material) => {
    if (material.material_type === 'SHEET') return 'Sheet';
    if (material.material_type === 'ROLL') return 'Roll';
    if (material.material_type === 'BOARD') return 'Board';
    if (material.material_type === 'UNIT') return 'Pack';
    if (material.material_type === 'INK') return 'Ink / Liquid';
    if (material.material_type === 'PROFILE') return 'Profile';
    return material.material_type || '-';
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Materials Pricelist</h1>
            <p className="text-slate-600 mt-2">
              Manage material inventory and pricing in ZAR.
            </p>
          </div>

          <div className="flex items-start gap-2 whitespace-nowrap">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportMaterials}
              data-testid="import-materials-file-input"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => importFileRef.current?.click()}
              data-testid="import-materials-btn"
              className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Import Materials CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportMaterials}
              data-testid="export-materials-btn"
            >
              Export Materials CSV
            </Button>

            {canEdit && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleOpenCreateMaterial}
                    data-testid="add-material-btn"
                    className="bg-[#2563EB] text-white hover:bg-[#1d4ed8] whitespace-nowrap"
                  >
                    <Plus size={18} className="mr-2" />
                    Add Material
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="material-dialog">
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Edit Material' : 'Add New Material'}</DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">
                        {formData.material_type === 'UNIT' ? 'Product Name *' : 'Material Name *'}
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        data-testid="material-name-input"
                        placeholder="e.g., Vinyl Matte"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="material_type">Category *</Label>
                      <Select
                        value={formData.material_type}
                        onValueChange={(v) => setFormData({ ...formData, material_type: v })}
                      >
                        <SelectTrigger data-testid="material-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SHEET">Sheet</SelectItem>
                          <SelectItem value="ROLL">Roll</SelectItem>
                          <SelectItem value="BOARD">Board</SelectItem>
                          <SelectItem value="UNIT">Pack / Unit</SelectItem>
                          <SelectItem value="INK">Ink / Paint / Liquid</SelectItem>
                          <SelectItem value="PROFILE">Profiles & Structural</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">{getCategoryHint()}</p>
                    </div>

                    {['SHEET', 'ROLL', 'BOARD'].includes(formData.material_type) && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="unit_price">Total Roll / Sheet / Board Price (ZAR)</Label>
                          <Input
                            id="unit_price"
                            type="number"
                            step="0.01"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                            data-testid="material-unit-price-input"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="width">{dimensionLabels.width}</Label>
                            <Input
                              id="width"
                              type="text"
                              value={formData.width}
                              onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                              data-testid="material-width-input"
                              placeholder="e.g., 1370mm or 1.37m"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="height">{dimensionLabels.height}</Label>
                            <Input
                              id="height"
                              type="text"
                              value={formData.height}
                              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                              data-testid="material-height-input"
                              placeholder="e.g., 50000mm or 50m"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {formData.material_type !== 'ROLL' && (
                            <div className="space-y-2">
                              <Label htmlFor="thickness">Thickness</Label>
                              <Input
                                id="thickness"
                                type="text"
                                value={formData.thickness}
                                onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
                                data-testid="material-thickness-input"
                                placeholder="e.g., 3mm"
                              />
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="sqm_price">Direct Cost per m² (ZAR)</Label>
                            <Input
                              id="sqm_price"
                              type="number"
                              step="0.01"
                              value={formData.sqm_price}
                              onChange={(e) => setFormData({ ...formData, sqm_price: e.target.value })}
                              disabled={!!formData.unit_price}
                              data-testid="material-price-input"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {formData.material_type === 'INK' && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Container Price (ZAR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Liters per Container</Label>
                          <Input
                            type="text"
                            value={formData.volume_liters}
                            onChange={(e) => setFormData({ ...formData, volume_liters: e.target.value })}
                            placeholder="e.g., 5L or 5000ml"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>CC / ML per m²</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.cc_per_sqm}
                            onChange={(e) => setFormData({ ...formData, cc_per_sqm: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {formData.material_type === 'UNIT' && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Pack Price (ZAR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Quantity in Pack</Label>
                          <Input
                            type="number"
                            step="1"
                            value={formData.quantity_per_unit}
                            onChange={(e) => setFormData({ ...formData, quantity_per_unit: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {formData.material_type === 'PROFILE' && (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Profile Length</Label>
                          <Input
                            type="text"
                            value={formData.length_mm}
                            onChange={(e) => setFormData({ ...formData, length_mm: e.target.value })}
                            placeholder="e.g., 6000mm or 6m"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Total Price (ZAR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.unit_price}
                            onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="supplier">Supplier</Label>
                        <Input
                          id="supplier"
                          value={formData.supplier}
                          onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                          data-testid="material-supplier-input"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="material_grade">Material Grade</Label>
                        <Input
                          id="material_grade"
                          value={formData.material_grade}
                          onChange={(e) => setFormData({ ...formData, material_grade: e.target.value })}
                          data-testid="material-grade-input"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="waste_default_percent">Waste (%) *</Label>
                      <Input
                        id="waste_default_percent"
                        type="number"
                        step="0.1"
                        value={formData.waste_default_percent}
                        onChange={(e) => setFormData({ ...formData, waste_default_percent: e.target.value })}
                        required
                        data-testid="material-waste-input"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product_specs">Product Specifications</Label>
                      <Textarea
                        id="product_specs"
                        value={formData.product_specs}
                        onChange={(e) => setFormData({ ...formData, product_specs: e.target.value })}
                        data-testid="material-specs-input"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        data-testid="material-submit-btn"
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
          Use the exported CSV as your template. Matching names update existing materials, new names are added.
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-sm space-y-2">
            <Label htmlFor="material-search">Search Materials</Label>
            <Input
              id="material-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, supplier, or grade"
              data-testid="material-search-input"
            />
          </div>

          <div className="w-full md:w-56 space-y-2">
            <Label htmlFor="material-category-filter">Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger id="material-category-filter" data-testid="material-category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="SHEET">Sheet</SelectItem>
                <SelectItem value="ROLL">Roll</SelectItem>
                <SelectItem value="BOARD">Board</SelectItem>
                <SelectItem value="UNIT">Pack</SelectItem>
                <SelectItem value="INK">Ink / Paint / Liquid</SelectItem>
                <SelectItem value="PROFILE">Profiles & Structural</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
          <div className="space-y-0">
            <div className="overflow-x-auto rounded-xl border bg-white">
              <Table className="w-full min-w-[1200px] text-sm">
                <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <TableRow>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Dimensions</TableHead>
                    <TableHead className="text-right">Product Total</TableHead>
                    <TableHead className="text-right">Area</TableHead>
                    <TableHead className="text-right">Thickness</TableHead>
                    <TableHead className="text-right">Cost / m² / Unit</TableHead>
                    <TableHead className="text-right">Effective / m²</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Waste</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredMaterials.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEdit ? 12 : 11} className="py-12">
                        <div className="mx-auto flex max-w-xl flex-col items-center justify-center text-center">
                          <div className="text-lg font-semibold text-slate-900">
                            {materials.length === 0 ? 'No materials added yet' : 'No materials match your search'}
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {materials.length === 0
                              ? 'Add the substrates and material costs your business uses for quotes.'
                              : 'Try a different search term or category filter.'}
                          </div>

                          {canEdit && materials.length === 0 && (
                            <button
                              type="button"
                              onClick={handleOpenCreateMaterial}
                              data-testid="add-material-btn"
                              className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                            >
                              Add your first material
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedMaterials.map((material) => {
                      let dimensions = '-';

                      if (material.material_type === 'UNIT') {
                        dimensions = material.quantity_per_unit
                          ? `${material.quantity_per_unit} items / pack`
                          : 'Pack';
                      } else if (material.material_type === 'PROFILE') {
                        dimensions = material.length_mm
                          ? `${material.length_mm}mm length`
                          : material.product_specs || '-';
                      } else if (material.width && material.height) {
                        dimensions = `${material.width} W × ${material.height} L`;
                      }

                      const totalSqm =
                        material.total_sqm !== null && material.total_sqm !== undefined
                          ? `${material.total_sqm.toFixed(2)} m²`
                          : '-';

                      const productTotalPrice =
                        material.unit_price !== null && material.unit_price !== undefined
                          ? money(material.unit_price)
                          : '-';

                      const price = material.material_type === 'UNIT'
                        ? (
                          material.unit_price !== null &&
                          material.unit_price !== undefined &&
                          material.quantity_per_unit !== null &&
                          material.quantity_per_unit !== undefined &&
                          material.quantity_per_unit > 0
                            ? `${money(material.unit_price / material.quantity_per_unit)} / item`
                            : material.unit_price !== null && material.unit_price !== undefined
                              ? `${money(material.unit_price)} / pack`
                              : '-'
                        )
                        : material.sqm_price !== null && material.sqm_price !== undefined
                          ? money(material.sqm_price)
                          : '-';

                      let effectiveCost = '-';

                      if (
                        material.material_type !== 'UNIT' &&
                        material.sqm_price !== null &&
                        material.sqm_price !== undefined &&
                        material.waste_default_percent !== null &&
                        material.waste_default_percent !== undefined
                      ) {
                        const calc = material.sqm_price * (1 + material.waste_default_percent / 100);
                        effectiveCost = money(calc);
                      }

                      return (
                        <TableRow key={material.id} data-testid={`material-row-${material.id}`}>
                          <TableCell className="min-w-[220px] font-semibold text-slate-900 align-top">
                            {material.name}
                          </TableCell>
                          <TableCell className="align-top text-sm">{getDisplayCategory(material)}</TableCell>
                          <TableCell className="data-mono align-top text-sm text-slate-600 whitespace-nowrap">
                            {dimensions}
                          </TableCell>
                          <TableCell className="data-mono align-top text-right whitespace-nowrap">
                            {productTotalPrice}
                          </TableCell>
                          <TableCell className="data-mono align-top text-right whitespace-nowrap">
                            {totalSqm}
                          </TableCell>
                          <TableCell className="data-mono align-top text-right whitespace-nowrap">
                            {material.thickness !== null && material.thickness !== undefined
                              ? `${material.thickness} mm`
                              : '-'}
                          </TableCell>
                          <TableCell className="data-mono align-top text-right whitespace-nowrap">
                            {price}
                          </TableCell>
                          <TableCell className="data-mono align-top text-right whitespace-nowrap">
                            {effectiveCost}
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-500 whitespace-nowrap">
                            {material.supplier || '-'}
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-500 whitespace-nowrap">
                            {material.material_grade || '-'}
                          </TableCell>
                          <TableCell className="data-mono align-top text-right whitespace-nowrap">
                            {material.waste_default_percent !== null && material.waste_default_percent !== undefined
                              ? `${material.waste_default_percent}%`
                              : '-'}
                          </TableCell>

                          {canEdit && (
                            <TableCell className="align-top text-right whitespace-nowrap">
                              <div className="flex justify-end gap-3 items-start">
                                <ActionIconButton
                                  icon={<Info size={16} />}
                                  label="Usage"
                                  tone="info"
                                  onClick={() => handleShowUsage(material.id)}
                                  title="Show recipe usage"
                                />

                                <ActionIconButton
                                  icon={<Pencil size={16} />}
                                  label="Edit"
                                  tone="edit"
                                  onClick={() => handleEdit(material)}
                                />

                                <ActionIconButton
                                  icon={<Trash2 size={16} />}
                                  label="Delete"
                                  tone="delete"
                                  onClick={() => handleDelete(material.id)}
                                />
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
              <div className="text-sm text-slate-500">
                Showing {filteredMaterials.length === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredMaterials.length)} of{' '}
                {filteredMaterials.length} materials
              </div>

              <div className="flex items-start gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || filteredMaterials.length === 0}
                >
                  Previous
                </Button>

                <span className="text-sm text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || filteredMaterials.length === 0}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
