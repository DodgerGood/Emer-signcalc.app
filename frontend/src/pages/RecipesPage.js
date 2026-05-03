import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Plus, Trash2, Package, Droplet, Users, Wrench, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';

const LINE_TYPES = [
  'MATERIAL',
  'INK',
  'LABOUR',
  'MACHINE',
  'INSTALL',
  'CUSTOM'
];

const QTY_DRIVERS = ['SQM', 'HOURS', 'PER_JOB'];

export default function RecipesPage() {
  const { isManager, isMDAdmin } = useAuth();

  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [inks, setInks] = useState([]);
  const [labours, setLabours] = useState([]);
  const [installs, setInstalls] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const importFileRef = useRef(null);

  const itemsPerPage = 9;

  const [formData, setFormData] = useState({
    name: '',
    lines: []
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [recipesRes, materialsRes, inksRes, laboursRes, installsRes] = await Promise.all([
        api.get('/recipes'),
        api.get('/materials'),
        api.get('/ink-profiles'),
        api.get('/labour-types'),
        api.get('/install-types')
      ]);

      setRecipes(recipesRes.data || []);
      setMaterials(materialsRes.data || []);
      setInks(inksRes.data || []);
      setLabours(laboursRes.data || []);
      setInstalls(installsRes.data || []);
    } catch (error) {
      toast.error('Failed to load recipes data');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecipes = filteredRecipes.slice(startIndex, startIndex + itemsPerPage);

  const resetForm = () => {
    setFormData({
      name: '',
      lines: []
    });
  };

  const handleOpenCreateRecipe = () => {
    resetForm();
    setDialogOpen(true);
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        {
          line_type: 'MATERIAL',
          reference_id: '',
          qty_driver: 'SQM',
          multiplier: 1,
          waste_percent: 0,
          default_markup_percent: 30,
          markup_allowed: true,
          override_requires_approval: false,
          custom_name: '',
          custom_unit_cost: 0
        }
      ]
    });
  };

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index][field] = value;

    if (field === 'line_type') {
      newLines[index].reference_id = '';
      newLines[index].custom_name = '';
      newLines[index].custom_unit_cost = 0;

      if (value === 'CUSTOM') {
        newLines[index].qty_driver = 'PER_JOB';
      }

      if (value === 'MACHINE') {
        newLines[index].qty_driver = 'SQM';
      }
    }

    setFormData({ ...formData, lines: newLines });
  };

  const removeLine = (index) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter((_, i) => i !== index)
    });
  };

  const getRefOptions = (lineType) => {
    switch (lineType) {
      case 'MATERIAL':
        return materials;
      case 'INK':
        return inks;
      case 'LABOUR':
        return labours.filter((item) => item.cost_type !== 'MACHINE');
      case 'MACHINE':
        return labours.filter((item) => item.cost_type === 'MACHINE');
      case 'INSTALL':
        return installs;
      default:
        return [];
    }
  };

  const getLineIcon = (type) => {
    switch (type) {
      case 'MATERIAL':
        return <Package size={16} />;
      case 'INK':
        return <Droplet size={16} />;
      case 'LABOUR':
      case 'MACHINE':
        return <Users size={16} />;
      case 'INSTALL':
        return <Wrench size={16} />;
      default:
        return <Plus size={16} />;
    }
  };

  const getReferenceName = (line) => {
    if (line.line_type === 'CUSTOM') {
      return line.custom_name || 'Custom item';
    }

    const found = getRefOptions(line.line_type).find((item) => item.id === line.reference_id);
    return found?.name || 'No item selected';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!(isManager() || isMDAdmin())) {
      toast.error('Only managers can create recipes');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        lines: formData.lines.map((line) => ({
          line_type: line.line_type,
          reference_id: line.line_type === 'CUSTOM' ? null : line.reference_id,
          qty_driver: line.qty_driver,
          multiplier: parseFloat(line.multiplier) || 0,
          waste_percent: parseFloat(line.waste_percent) || 0,
          default_markup_percent: parseFloat(line.default_markup_percent) || 0,
          markup_allowed: !!line.markup_allowed,
          override_requires_approval: !!line.override_requires_approval,
          custom_name: line.custom_name || null,
          custom_unit_cost:
            line.line_type === 'CUSTOM'
              ? parseFloat(line.custom_unit_cost) || 0
              : null
        }))
      };

      await api.post('/recipes', payload);

      toast.success('Recipe created');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create recipe');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Deleting this recipe may affect quotes that use it. Click OK to delete.')) return;

    try {
      await api.delete(`/recipes/${id}`);
      toast.success('Recipe deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete recipe');
    }
  };

  const handleExportRecipes = async () => {
    try {
      const response = await api.get('/recipes/export', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'recipes_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Recipes export downloaded');
    } catch (error) {
      toast.error('Recipe export endpoint not ready yet');
    }
  };

  const handleImportRecipes = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await api.post('/recipes/import', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const result = response.data;

      toast.success(
        `Import complete: ${result.imported_count || 0} added, ${result.updated_count || 0} updated`
      );

      if (result.error_count > 0) {
        toast.error(`${result.error_count} row(s) had errors`);
        console.log('Recipe import errors:', result.errors);
      }

      loadData();
    } catch (error) {
      toast.error('Recipe import endpoint not ready yet');
    } finally {
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Recipes</h1>
            <p className="text-slate-600 mt-2">
              Pricing assemblies that combine materials, labour, machines, installations, and custom line items.
            </p>
          </div>

          {(isManager() || isMDAdmin()) && (
            <div className="flex shrink-0 items-center gap-2">
              <input
                ref={importFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImportRecipes}
                data-testid="import-recipes-file-input"
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => importFileRef.current?.click()}
                className="border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                <Upload size={16} className="mr-2" />
                Import CSV
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleExportRecipes}
              >
                <Download size={16} className="mr-2" />
                Export CSV
              </Button>

              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleOpenCreateRecipe}
                    data-testid="add-recipe-btn"
                    className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                  >
                    <Plus size={18} className="mr-2" />
                    Add Recipe
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Recipe</DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="recipe-name">Recipe Name *</Label>
                      <Input
                        id="recipe-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        data-testid="recipe-name-input"
                        placeholder="e.g., Standard ACM sign with print and installation"
                      />
                      <p className="text-xs text-slate-500">
                        Give this recipe a clear name so it can be reused in quotes.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold">Recipe Lines</h3>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addLine}
                          data-testid="add-recipe-line-btn"
                          variant="outline"
                        >
                          <Plus size={16} className="mr-2" />
                          Add Line
                        </Button>
                      </div>

                      {formData.lines.length === 0 ? (
                        <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                          No recipe lines yet. Add materials, labour, machines, installations, or custom items.
                        </div>
                      ) : (
                        formData.lines.map((line, index) => (
                          <Card key={index} className="p-4">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2 font-semibold">
                                {getLineIcon(line.line_type)}
                                Line {index + 1}
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => removeLine(index)}
                                data-testid={`remove-line-${index}`}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 size={16} className="mr-2" />
                                Remove
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Line Type</Label>
                                <Select
                                  value={line.line_type}
                                  onValueChange={(v) => updateLine(index, 'line_type', v)}
                                >
                                  <SelectTrigger data-testid={`line-${index}-type`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LINE_TYPES.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {line.line_type !== 'CUSTOM' && (
                                <div className="space-y-2">
                                  <Label>Reference</Label>
                                  <Select
                                    value={line.reference_id}
                                    onValueChange={(v) => updateLine(index, 'reference_id', v)}
                                  >
                                    <SelectTrigger data-testid={`line-${index}-ref`}>
                                      <SelectValue placeholder="Select item..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {getRefOptions(line.line_type).map((option) => (
                                        <SelectItem key={option.id} value={option.id}>
                                          {option.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-slate-500">
                                    Select from your existing pricelist records.
                                  </p>
                                </div>
                              )}

                              {line.line_type === 'CUSTOM' && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Custom Item Name</Label>
                                    <Input
                                      value={line.custom_name || ''}
                                      onChange={(e) => updateLine(index, 'custom_name', e.target.value)}
                                      placeholder="e.g., Special bracket set"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Custom Unit Cost (ZAR)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={line.custom_unit_cost || 0}
                                      onChange={(e) => updateLine(index, 'custom_unit_cost', parseFloat(e.target.value) || 0)}
                                      placeholder="e.g., 250"
                                    />
                                  </div>
                                </>
                              )}

                              <div className="space-y-2">
                                <Label>Qty Driver</Label>
                                <Select
                                  value={line.qty_driver}
                                  onValueChange={(v) => updateLine(index, 'qty_driver', v)}
                                >
                                  <SelectTrigger data-testid={`line-${index}-driver`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {QTY_DRIVERS.map((driver) => (
                                      <SelectItem key={driver} value={driver}>
                                        {driver}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500">
                                  SQM uses quote area. HOURS uses this line as hours. PER_JOB is once-off.
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label>Multiplier</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={line.multiplier}
                                  onChange={(e) => updateLine(index, 'multiplier', parseFloat(e.target.value) || 0)}
                                  data-testid={`line-${index}-multiplier`}
                                />
                                <p className="text-xs text-slate-500">
                                  Used to scale this line. Example: 1 = normal, 2 = double.
                                </p>
                              </div>

                              <div className="space-y-2">
                                <Label>Waste %</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={line.waste_percent}
                                  onChange={(e) => updateLine(index, 'waste_percent', parseFloat(e.target.value) || 0)}
                                  data-testid={`line-${index}-waste`}
                                />
                              </div>

                              <div className="space-y-2">
                                <Label>Default Markup %</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={line.default_markup_percent}
                                  onChange={(e) => updateLine(index, 'default_markup_percent', parseFloat(e.target.value) || 0)}
                                  data-testid={`line-${index}-markup`}
                                />
                              </div>

                              <div className="flex items-center space-x-2 pt-6">
                                <input
                                  type="checkbox"
                                  id={`markup-${index}`}
                                  checked={line.markup_allowed}
                                  onChange={(e) => updateLine(index, 'markup_allowed', e.target.checked)}
                                  data-testid={`line-${index}-markup-allowed`}
                                />
                                <Label htmlFor={`markup-${index}`} className="text-sm">
                                  Markup Allowed
                                </Label>
                              </div>

                              <div className="flex items-center space-x-2 pt-6">
                                <input
                                  type="checkbox"
                                  id={`approval-${index}`}
                                  checked={line.override_requires_approval}
                                  onChange={(e) => updateLine(index, 'override_requires_approval', e.target.checked)}
                                  data-testid={`line-${index}-approval-required`}
                                />
                                <Label htmlFor={`approval-${index}`} className="text-sm">
                                  Override Requires Approval
                                </Label>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        type="submit"
                        data-testid="recipe-submit-btn"
                        className="bg-[#2563EB] hover:bg-[#1e40af]"
                      >
                        Create Recipe
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
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-sm space-y-2">
            <Label htmlFor="recipe-search">Search Recipes</Label>
            <Input
              id="recipe-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by recipe name"
              data-testid="recipe-search-input"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                <div className="text-lg font-semibold text-slate-900">
                  No recipes added yet
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Recipes combine materials, labour, machines, installation, and custom items into reusable pricing structures.
                </div>

                {(isManager() || isMDAdmin()) && (
                  <button
                    type="button"
                    onClick={handleOpenCreateRecipe}
                    data-testid="add-first-recipe-btn"
                    className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                  >
                    Add your first recipe
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedRecipes.map((recipe) => (
                <Card key={recipe.id} className="card-technical" data-testid={`recipe-${recipe.id}`}>
                  <CardHeader>
                    <CardTitle className="flex justify-between items-start gap-3">
                      <span className="text-lg">{recipe.name}</span>
                      <span className="text-xs text-slate-500 font-mono">v{recipe.version}</span>
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      {(recipe.lines || []).map((line, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                          {getLineIcon(line.line_type)}
                          <span>{line.line_type}</span>
                          <span className="text-xs text-slate-400">({line.qty_driver})</span>
                        </div>
                      ))}
                    </div>

                    {(isManager() || isMDAdmin()) && (
                      <div className="mt-4 pt-4 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(recipe.id)}
                          data-testid={`delete-recipe-${recipe.id}`}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                        >
                          <Trash2 size={16} className="mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {filteredRecipes.length === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredRecipes.length)} of{' '}
                {filteredRecipes.length} recipes
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
