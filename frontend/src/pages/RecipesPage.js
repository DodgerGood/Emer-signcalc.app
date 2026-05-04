import React, { useEffect, useState } from 'react';
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

  const itemsPerPage = 9;

  const [formData, setFormData] = useState({
    name: '',
    material_markup_percent: 30,

    material_id: 'NA',
    material_custom_name: '',
    material_custom_cost: '',

    labour_id: 'NA',
    labour_custom_name: '',
    labour_custom_cost: '',

    machine_id: 'NA',
    machine_custom_name: '',
    machine_custom_cost: '',

    install_id: 'NA',
    install_custom_name: '',
    install_custom_cost: '',
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
      material_custom_name: '',
      material_custom_cost: '',

      labour_id: 'NA',
      labour_custom_name: '',
      labour_custom_cost: '',

      machine_id: 'NA',
      machine_custom_name: '',
      machine_custom_cost: '',

      install_id: 'NA',
      install_custom_name: '',
      install_custom_cost: '',
    });
  };

  const handleOpenCreateRecipe = () => {
    resetForm();
    setDialogOpen(true);
  };

  const addExistingLine = (lines, lineType, referenceId, markupAllowed, markupPercent) => {
    if (!referenceId || referenceId === 'NA' || referenceId === 'CUSTOM') return;

    lines.push({
      line_type: lineType,
      reference_id: referenceId,
      qty_driver: 'SQM',
      multiplier: 1,
      waste_percent: 0,
      default_markup_percent: markupAllowed ? parseFloat(markupPercent) || 0 : 0,
      markup_allowed: markupAllowed,
      override_requires_approval: false,
      custom_name: null,
      custom_unit_cost: null,
    });
  };

  const addCustomLine = (lines, customName, customCost, markupAllowed, markupPercent) => {
    if (!customName || !(Number(customCost) > 0)) return;

    lines.push({
      line_type: 'CUSTOM',
      reference_id: null,
      qty_driver: 'SQM',
      multiplier: 1,
      waste_percent: 0,
      default_markup_percent: markupAllowed ? parseFloat(markupPercent) || 0 : 0,
      markup_allowed: markupAllowed,
      override_requires_approval: false,
      custom_name: customName,
      custom_unit_cost: parseFloat(customCost) || 0,
    });
  };

  const buildRecipeLines = () => {
    const lines = [];

    if (formData.material_id === 'CUSTOM') {
      addCustomLine(
        lines,
        formData.material_custom_name,
        formData.material_custom_cost,
        true,
        formData.material_markup_percent
      );
    } else {
      addExistingLine(lines, 'MATERIAL', formData.material_id, true, formData.material_markup_percent);
    }

    if (formData.labour_id === 'CUSTOM') {
      addCustomLine(lines, formData.labour_custom_name, formData.labour_custom_cost, false, 0);
    } else {
      addExistingLine(lines, 'LABOUR', formData.labour_id, false, 0);
    }

    if (formData.machine_id === 'CUSTOM') {
      addCustomLine(lines, formData.machine_custom_name, formData.machine_custom_cost, false, 0);
    } else {
      addExistingLine(lines, 'MACHINE', formData.machine_id, false, 0);
    }

    if (formData.install_id === 'CUSTOM') {
      addCustomLine(lines, formData.install_custom_name, formData.install_custom_cost, false, 0);
    } else {
      addExistingLine(lines, 'INSTALL', formData.install_id, false, 0);
    }

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

  const getLineIcon = (type) => {
    switch (type) {
      case 'MATERIAL':
      case 'CUSTOM':
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
                    This recipe represents the cost to produce <strong>1 m²</strong>. Select an existing item,
                    choose N/A, or enter a custom item for each section.
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
                      <CardTitle className="text-lg">Material</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Material Reference</Label>
                          <Select
                            value={formData.material_id}
                            onValueChange={(v) => setFormData({ ...formData, material_id: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NA">N/A</SelectItem>
                              <SelectItem value="CUSTOM">Custom Material</SelectItem>
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
                            Markup applies to materials only. Labour, machines, and installation are not marked up.
                          </p>
                        </div>
                      </div>

                      {formData.material_id === 'CUSTOM' && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Custom Material Name</Label>
                            <Input
                              value={formData.material_custom_name}
                              onChange={(e) =>
                                setFormData({ ...formData, material_custom_name: e.target.value })
                              }
                              placeholder="e.g., Special imported vinyl"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Custom Material Cost / m² (ZAR)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.material_custom_cost}
                              onChange={(e) =>
                                setFormData({ ...formData, material_custom_cost: e.target.value })
                              }
                              placeholder="e.g., 85"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Labour</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Labour Reference</Label>
                        <Select
                          value={formData.labour_id}
                          onValueChange={(v) => setFormData({ ...formData, labour_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NA">N/A</SelectItem>
                            <SelectItem value="CUSTOM">Custom Labour</SelectItem>
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

                      {formData.labour_id === 'CUSTOM' && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Custom Labour Name</Label>
                            <Input
                              value={formData.labour_custom_name}
                              onChange={(e) =>
                                setFormData({ ...formData, labour_custom_name: e.target.value })
                              }
                              placeholder="e.g., Special application labour"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Custom Labour Cost / m² (ZAR)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.labour_custom_cost}
                              onChange={(e) =>
                                setFormData({ ...formData, labour_custom_cost: e.target.value })
                              }
                              placeholder="e.g., 25"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Machine</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Machine Reference</Label>
                        <Select
                          value={formData.machine_id}
                          onValueChange={(v) => setFormData({ ...formData, machine_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NA">N/A</SelectItem>
                            <SelectItem value="CUSTOM">Custom Machine</SelectItem>
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

                      {formData.machine_id === 'CUSTOM' && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Custom Machine Name</Label>
                            <Input
                              value={formData.machine_custom_name}
                              onChange={(e) =>
                                setFormData({ ...formData, machine_custom_name: e.target.value })
                              }
                              placeholder="e.g., Outsourced CNC cutting"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Custom Machine Cost / m² (ZAR)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.machine_custom_cost}
                              onChange={(e) =>
                                setFormData({ ...formData, machine_custom_cost: e.target.value })
                              }
                              placeholder="e.g., 40"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Installation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Installation Reference</Label>
                        <Select
                          value={formData.install_id}
                          onValueChange={(v) => setFormData({ ...formData, install_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NA">N/A</SelectItem>
                            <SelectItem value="CUSTOM">Custom Installation</SelectItem>
                            {installs.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.install_id === 'CUSTOM' && (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Custom Installation Name</Label>
                            <Input
                              value={formData.install_custom_name}
                              onChange={(e) =>
                                setFormData({ ...formData, install_custom_name: e.target.value })
                              }
                              placeholder="e.g., High access installation"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Custom Installation Cost / m² (ZAR)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.install_custom_cost}
                              onChange={(e) =>
                                setFormData({ ...formData, install_custom_cost: e.target.value })
                              }
                              placeholder="e.g., 60"
                            />
                          </div>
                        </div>
                      )}
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
                          <span>{line.custom_name || line.line_type}</span>
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

