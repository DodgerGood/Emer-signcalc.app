import React, { useEffect, useState } from 'react';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MaterialsPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    material_type: 'SHEET',
    width: '',
    height: '',
    thickness: '',
    sqm_price: '',
    unit_price: '',
    supplier: '',
    material_grade: '',
    product_specs: '',
    waste_default_percent: '10'
  });

const canEdit =
  user?.role === 'PROCUREMENT' ||
  user?.role === 'CEO' ||
  user?.role === 'MD_ADMIN';

  useEffect(() => { loadMaterials(); }, []);

  const loadMaterials = async () => {
    try {
      const response = await api.get('/materials');
      setMaterials(response.data);
    } catch (error) {
      toast.error('Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        material_type: formData.material_type,
        width: formData.width ? parseFloat(formData.width) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        thickness: formData.thickness ? parseFloat(formData.thickness) : null,
        sqm_price: formData.sqm_price ? parseFloat(formData.sqm_price) : null,
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
        supplier: formData.supplier || null,
        material_grade: formData.material_grade || null,
        product_specs: formData.product_specs || null,
        waste_default_percent: parseFloat(formData.waste_default_percent)
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
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (material) => {
    setEditingId(material.id);
    setFormData({
      name: material.name,
      material_type: material.material_type,
      width: material.width?.toString() || '',
      height: material.height?.toString() || '',
      thickness: material.thickness?.toString() || '',
      sqm_price: material.sqm_price?.toString() || '',
      unit_price: material.unit_price?.toString() || '',
      supplier: material.supplier || '',
      material_grade: material.material_grade || '',
      product_specs: material.product_specs || '',
      waste_default_percent: material.waste_default_percent.toString()
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this material?')) return;
    try {
      await api.delete(`/materials/${id}`);
      toast.success('Material deleted');
      loadMaterials();
    } catch (error) {
      toast.error('Failed to delete material');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      material_type: 'SHEET',
      width: '',
      height: '',
      thickness: '',
      sqm_price: '',
      unit_price: '',
      supplier: '',
      material_grade: '',
      product_specs: '',
      waste_default_percent: '10'
    });
  };

  const handleOpenCreateMaterial = () => {
    setEditingId(null);
    setFormData({
      name: '',
      type: '',
      width_mm: '',
      height_mm: '',
      total_sqm: '',
      thickness: '',
      price_zar: '',
      supplier: '',
      grade: '',
      waste_percent: '',
    });
    setDialogOpen(true)
  };

  // Helper to get dimension label based on material type
  const getDimensionLabels = () => {
    switch (formData.material_type) {
      case 'ROLL':
        return { width: 'Roll Width (mm)', height: 'Roll Length (mm)' };
      case 'SHEET':
        return { width: 'Sheet Width (mm)', height: 'Sheet Length (mm)' };
      case 'BOARD':
        return { width: 'Board Width (mm)', height: 'Board Length (mm)' };
      default:
        return { width: 'Width (mm)', height: 'Height (mm)' };
    }
  };

  const dimensionLabels = getDimensionLabels();

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Materials Pricelist</h1>
            <p className="text-slate-600 mt-2">Manage material inventory and pricing (ZAR)</p>
          </div>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreateMaterial} data-testid="add-material-btn" className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]">
                  <Plus size={18} className="mr-2" />Add Material
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="material-dialog">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Material' : 'Add New Material'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Material Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="material-name-input"
                      placeholder="e.g., Vinyl Matte"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="material_type">Category *</Label>
                    <Select value={formData.material_type} onValueChange={(v) => setFormData({ ...formData, material_type: v })}>
                      <SelectTrigger data-testid="material-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SHEET">Sheet</SelectItem>
                        <SelectItem value="ROLL">Roll</SelectItem>
                        <SelectItem value="BOARD">Board</SelectItem>
                        <SelectItem value="UNIT">Unit (e.g., LED Module)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.material_type !== 'UNIT' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="width">{dimensionLabels.width}</Label>
                        <Input
                          id="width"
                          type="number"
                          step="0.1"
                          value={formData.width}
                          onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                          data-testid="material-width-input"
                          placeholder="e.g., 1370"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="height">{dimensionLabels.height}</Label>
                        <Input
                          id="height"
                          type="number"
                          step="0.1"
                          value={formData.height}
                          onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                          data-testid="material-height-input"
                          placeholder="e.g., 50000"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="thickness">Thickness (mm)</Label>
                      <Input
                        id="thickness"
                        type="number"
                        step="0.01"
                        value={formData.thickness}
                        onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
                        data-testid="material-thickness-input"
                      />
                    </div>
                    {formData.material_type !== 'UNIT' ? (
                      <div className="space-y-2">
                        <Label htmlFor="sqm_price">Cost per m² (ZAR) *</Label>
                        <Input
                          id="sqm_price"
                          type="number"
                          step="0.01"
                          value={formData.sqm_price}
                          onChange={(e) => setFormData({ ...formData, sqm_price: e.target.value })}
                          required
                          data-testid="material-price-input"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="unit_price">Price per Unit (ZAR) *</Label>
                        <Input
                          id="unit_price"
                          type="number"
                          step="0.01"
                          value={formData.unit_price}
                          onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                          required
                          data-testid="material-unit-price-input"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                    <Button type="submit" data-testid="material-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                      {editingId ? 'Update' : 'Create'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} data-testid="material-cancel-btn">
                      Cancel
                    </Button>
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
        ) : (
          <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Product Dimensions (mm)</TableHead>
                    <TableHead>Total Area (m²)</TableHead>
                    <TableHead>Thickness (mm)</TableHead>
                    <TableHead className="data-mono">Cost per m² (ZAR)</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Material Grade</TableHead>
                    <TableHead className="data-mono">Waste (%)</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 10 : 9} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                      <div className="text-lg font-semibold text-slate-900">
                        No materials added yet
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        Add the substrates and material costs your business uses so pricing can
                        flow into recipes and quotes.
                      </div>

                      {canEdit && (
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
                  materials.map((material) => {
                    let dimensions = '-';
                    if (material.material_type === 'UNIT') {
                      dimensions = 'Per Unit';
                    } else if (material.width && material.height) {
                      dimensions = `${material.width} × ${material.height}`;
                    }

                    const totalSqm = material.total_sqm ? `${material.total_sqm.toFixed(2)} m²` : '-';

                    const price = material.material_type === 'UNIT'
                      ? (material.unit_price ? `R ${material.unit_price.toFixed(2)}/unit` : '-')
                      : (material.sqm_price ? `R ${material.sqm_price.toFixed(2)}/sqm` : '-');

                    return (
                      <TableRow key={material.id} data-testid={`material-row-${material.id}`}>
                        <TableCell className="font-medium">{material.name}</TableCell>
                        <TableCell className="text-sm">{material.material_type}</TableCell>
                        <TableCell className="data-mono text-sm">{dimensions}</TableCell>
                        <TableCell className="data-mono text-sm">{totalSqm}</TableCell>
                        <TableCell className="data-mono text-sm">{material.thickness ? `${material.thickness}mm` : '-'}</TableCell>
                        <TableCell className="data-mono">{price}</TableCell>
                        <TableCell className="text-sm">{material.supplier || '-'}</TableCell>
                        <TableCell className="text-sm">{material.material_grade || '-'}</TableCell>
                        <TableCell className="data-mono">{material.waste_default_percent}%</TableCell>
                        {canEdit && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(material)} data-testid={`edit-material-${material.id}`}>
                              <Pencil size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(material.id)} data-testid={`delete-material-${material.id}`} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
