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
import { Plus, Trash2, Package, Users, Wrench } from 'lucide-react';
import { toast } from 'sonner';

export default function RecipesPage() {
  const { isManager, isMDAdmin } = useAuth();

  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
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
    material_markup_percent: 30,
    material_id: 'NA',
    labour_id: 'NA',
    machine_id: 'NA',
    install_id: 'NA',
    custom_lines: [],
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

      const [recipesRes, materialsRes, laboursRes, installsRes] = await Promise.all([
        api.get('/recipes'),
        api.get('/materials'),
        api.get('/labour-types'),
        api.get('/install-types'),
      ]);

      setRecipes(recipesRes.data || []);
      setMaterials(materialsRes.data || []);
      setLabours(laboursRes.data || []);
      setInstalls(installsRes.data || []);
    } catch {
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
      material_markup_percent: 30,
      material_id: 'NA',
      labour_id: 'NA',
      machine_id: 'NA',
      install_id: 'NA',
      custom_lines: [],
    });
  };

  const handleOpenCreateRecipe = () => {
    resetForm();
    setDialogOpen(true);
  };

  const addCustomLine = () => {
    setFormData({
      ...formData,
      custom_lines: [
        ...formData.custom_lines,
        {
          custom_name: '',
          custom_unit_cost: 0,
        },
      ],
    });
  };

  const updateCustomLine = (index, field, value) => {
    const updated = [...formData.custom_lines];
    updated[index][field] = value;
    setFormData({ ...formData, custom_lines: updated });
  };

  const removeCustomLine = (index) => {
    setFormData({
      ...formData,
      custom_lines: formData.custom_lines.filter((_, i) => i !== index),
    });
  };

  const buildRecipeLines = () => {
    const lines = [];

    if (formData.material_id !== 'NA') {
      lines.push({
        line_type: 'MATERIAL',
        reference_id: formData.material_id,
        qty_driver: 'SQM',
        multiplier: 1,
        waste_percent: 0,
        default_markup_percent: parseFloat(formData.material_markup_percent) || 0,
        markup_allowed: true,
        override_requires_approval: false,
        custom_name: null,
      });
    }

    if (formData.labour_id !== 'NA') {
      lines.push({
        line_type: 'LABOUR',
        reference_id: formData.labour_id,
        qty_driver: 'SQM',
        multiplier: 1,
        waste_percent: 0,
        default_markup_percent: 0,
        markup_allowed: false,
        override_requires_approval: false,
        custom_name: null,
      });
    }

    if (formData.machine_id !== 'NA') {
      lines.push({
        line_type: 'MACHINE',
        reference_id: formData.machine_id,
        qty_driver: 'SQM',
        multiplier: 1,
        waste_percent: 0,
        default_markup_percent: 0,
        markup_allowed: false,
        override_requires_approval: false,
        custom_name: null,
      });
    }

    if (formData.install_id !== 'NA') {
      lines.push({
        line_type: 'INSTALL',
        reference_id: formData.install_id,
        qty_driver: 'SQM',
        multiplier: 1,
        waste_percent: 0,
        default_markup_percent: 0,
        markup_allowed: false,
        override_requires_approval: false,
        custom_name: null,
      });
    }

    formData.custom_lines.forEach((line) => {
      if (line.custom_name && Number(line.custom_unit_cost) > 0) {
        lines.push({
          line_type: 'CUSTOM',
          reference_id: null,
          qty_driver: 'PER_JOB',
          multiplier: 1,
          waste_percent: 0,
          default_markup_percent: 0,
          markup_allowed: false,
          override_requires_approval: false,
          custom_name: line.custom_name,
          custom_unit_cost: parseFloat(line.custom_unit_cost) || 0,
        });
      }
    });

    return lines;
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
        lines: buildRecipeLines(),
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
    } catch {
      toast.error('Failed to delete recipe');
    }
  };

  const handleExportRecipes = async () => {
    try {
      const response = await api.get('/recipes/export', {
        responseType: 'blob',
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
    } catch {
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
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = response.data;

      toast.success(
        `Import complete: ${result.imported_count || 0} added, ${result.updated_count || 0} updated`
      );

      loadData();
    } catch {
      toast.error('Recipe import endpoint not ready yet');
    } finally {
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  const getLineIcon = (type) => {
    switch (type) {
      case 'MATERIAL':
        return <Package size={16} />;
      case 'LABOUR':
      case 'MACHINE':
        return <Users size={16} />;
      case 'INSTALL':
        return <Wrench size={16} />;
      default:
        return <Plus size={16} />;
    }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Recipes</h1>
            <p className="text-slate-600 mt-2">
              Build reusable 1 m² pricing recipes from materials, labour, machines, installation, and custom items.
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
              />

              <Button
                type="button"
                variant="outline"
                onClick={() => importFileRef.current?.click()}
                className="border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200"
              >
                Import CSV
              </Button>

              <Button type="button" variant="outline" onClick={handleExportRecipes}>
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

                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New 1 m² Recipe</DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                      This recipe represents the cost to produce <strong>1 m²</strong>. Materials, labour,
                      machines, and installation should already be reduced to a 1 m² costing basis.
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recipe-name">Recipe Name *</Label>
                      <Input
                        id="recipe-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        data-testid="recipe-name-input"
                        placeholder="e.g., Standard vinyl print and install per m²"
                      />
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Required Recipe Components</CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Material</Label>
                            <Select
                              value={formData.material_id}
                              onValueChange={(v) => setFormData({ ...formData, material_id: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NA">N/A</SelectItem>
                                {materials.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Material Markup %</Label>
                            <Input
                              type="number"
                              step="0.1"
                              value={formData.material_markup_percent}
                              onChange={(e) =>
                                setFormData({ ...formData, material_markup_percent: e.target.value })
                              }
                            />
                            <p className="text-xs text-slate-500">
                              Markup applies to materials only. Labour, machines, installation, and custom items are not marked up.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label>Labour</Label>
                            <Select
                              value={formData.labour_id}
                              onValueChange={(v) => setFormData({ ...formData, labour_id: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NA">N/A</SelectItem>
                                {labours
                                  .filter((item) => item.cost_type !== 'MACHINE')
                                  .map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Machine</Label>
                            <Select
                              value={formData.machine_id}
                              onValueChange={(v) => setFormData({ ...formData, machine_id: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NA">N/A</SelectItem>
                                {labours
                                  .filter((item) => item.cost_type === 'MACHINE')
                                  .map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Installation</Label>
                            <Select
                              value={formData.install_id}
                              onValueChange={(v) => setFormData({ ...formData, install_id: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NA">N/A</SelectItem>
                                {installs.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Custom Line Items</CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {formData.custom_lines.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No custom items added. Use this for once-off extras that do not belong in materials, labour, machines, or installation.
                          </p>
                        ) : (
                          formData.custom_lines.map((line, index) => (
                            <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_120px] md:items-start">
                              <div className="space-y-1">
                                <Input
                                  value={line.custom_name}
                                  onChange={(e) => updateCustomLine(index, 'custom_name', e.target.value)}
                                  placeholder="e.g., Special brackets"
                                />
                                <p className="text-xs text-slate-500">Custom item name.</p>
                              </div>

                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={line.custom_unit_cost}
                                  onChange={(e) => updateCustomLine(index, 'custom_unit_cost', e.target.value)}
                                  placeholder="Cost"
                                />
                                <p className="text-xs text-slate-500">Once-off cost.</p>
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                onClick={() => removeCustomLine(index)}
                                className="bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          ))
                        )}

                        <Button type="button" variant="outline" onClick={addCustomLine}>
                          + Add Custom Item
                        </Button>
                      </CardContent>
                    </Card>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" data-testid="recipe-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
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
                <div className="text-lg font-semibold text-slate-900">No recipes added yet</div>
                <div className="mt-2 text-sm text-slate-600">
                  Recipes combine 1 m² pricing inputs into reusable structures for quotes.
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
                          <span className="text-xs text-slate-400">
                            {line.markup_allowed ? '(material markup)' : '(no markup)'}
                          </span>
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
                {Math.min(startIndex + itemsPerPage, filteredRecipes.length)} of {filteredRecipes.length} recipes
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                  Previous
                </Button>

                <span>Page {currentPage} of {totalPages}</span>

                <Button type="button" variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
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
