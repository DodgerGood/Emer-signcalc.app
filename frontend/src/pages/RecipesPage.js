import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Card, CardContent } from '../components/ui/card';
import { Plus, Trash2, Info, Edit } from 'lucide-react';
import { toast } from 'sonner';

const MATERIAL_CATEGORIES = [
  { value: 'ALL', label: 'All Categories' },
  { value: 'SHEET', label: 'Sheet' },
  { value: 'ROLL', label: 'Roll' },
  { value: 'BOARD', label: 'Board' },
  { value: 'INK', label: 'Ink / Paint / Liquid' },
  { value: 'UNIT', label: 'Unit / Product' },
  { value: 'PROFILE', label: 'Profile' },
];

const newLabourMachineLine = () => ({
  temp_id: crypto.randomUUID(),
  labour_id: '',
});

const newMaterialGroup = () => ({
  temp_id: crypto.randomUUID(),
  material_category: 'ALL',
  material_id: '',
  labour_machine_lines: [newLabourMachineLine()],
});

const emptyForm = () => ({
  name: '',
  material_markup_percent: 30,
  material_groups: [newMaterialGroup()],
});

const money = (value) => `R ${(Number(value) || 0).toFixed(2)}`;

export default function RecipesPage() {
  const { isManager, isMDAdmin } = useAuth();

  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labourMachines, setLabourMachines] = useState([]);

  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [infoRecipe, setInfoRecipe] = useState(null);
  const [editingRecipeId, setEditingRecipeId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState(emptyForm());

  const itemsPerPage = 9;
  const canManage = isManager() || isMDAdmin();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [recipesRes, materialsRes, laboursRes] = await Promise.all([
        api.get('/recipes'),
        api.get('/materials'),
        api.get('/labour-types'),
      ]);

      setRecipes(recipesRes.data || []);
      setMaterials(materialsRes.data || []);
      setLabourMachines(laboursRes.data || []);
    } catch {
      toast.error('Failed to load recipes data');
    } finally {
      setLoading(false);
    }
  };

  const getMaterialCost = (material) => {
    if (!material) return 0;

    if (material.material_type === 'UNIT') {
      if (
        material.unit_price !== null &&
        material.unit_price !== undefined &&
        Number(material.quantity_per_unit) > 0
      ) {
        return Number(material.unit_price) / Number(material.quantity_per_unit);
      }

      return Number(material.unit_price) || 0;
    }

    return Number(material.sqm_price) || 0;
  };

  const getLabourMachineCost = (item) => {
    if (!item) return 0;

    const isMachine = item.cost_type === 'MACHINE';
    const sqmPerHour = Number(item.sqm_per_hour) || 0;

    if (isMachine) {
      const machineValue = Number(item.machine_value) || 0;
      const depreciationYears = Number(item.depreciation_years) || 0;
      const workingHoursPerYear = Number(item.working_hours_per_year) || 0;
      const electricityPerHour =
        (Number(item.power_kw) || 0) * (Number(item.electricity_cost_per_kwh) || 0);
      const operatorRate = Number(item.operator_hourly_rate) || 0;

      const machineRate =
        depreciationYears > 0 && workingHoursPerYear > 0
          ? machineValue / depreciationYears / workingHoursPerYear
          : Number(item.rate_per_hour) || 0;

      const hourlyTotal = machineRate + electricityPerHour + operatorRate;

      return sqmPerHour > 0 ? hourlyTotal / sqmPerHour : 0;
    }

    const people = Number(item.number_of_people) || 1;
    const toolsRate = (item.tools || []).reduce((sum, tool) => {
      return sum + ((Number(tool.quantity) || 0) * (Number(tool.cost_per_hour) || 0));
    }, 0);

    const hourlyTotal = ((Number(item.rate_per_hour) || 0) * people) + toolsRate;

    return sqmPerHour > 0 ? hourlyTotal / sqmPerHour : 0;
  };

  const materialById = useMemo(() => {
    const map = {};
    materials.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [materials]);

  const labourMachineById = useMemo(() => {
    const map = {};
    labourMachines.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [labourMachines]);

  const calculateFormTotals = () => {
    const materialCost = formData.material_groups.reduce((sum, group) => {
      return sum + getMaterialCost(materialById[group.material_id]);
    }, 0);

    const labourMachineCost = formData.material_groups.reduce((sum, group) => {
      const groupCost = group.labour_machine_lines.reduce((lineSum, line) => {
        return lineSum + getLabourMachineCost(labourMachineById[line.labour_id]);
      }, 0);

      return sum + groupCost;
    }, 0);

    const markupValue = materialCost * ((Number(formData.material_markup_percent) || 0) / 100);
    const totalSellingPrice = materialCost + labourMachineCost + markupValue;

    return {
      materialCost,
      labourMachineCost,
      markupValue,
      totalSellingPrice,
    };
  };

  const formTotals = calculateFormTotals();

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecipes = filteredRecipes.slice(startIndex, startIndex + itemsPerPage);

  const resetForm = () => {
    setEditingRecipeId(null);
    setFormData(emptyForm());
  };

  const handleOpenCreateRecipe = () => {
    resetForm();
    setDialogOpen(true);
  };

  const updateMaterialGroup = (groupId, updates) => {
    setFormData((prev) => ({
      ...prev,
      material_groups: prev.material_groups.map((group) =>
        group.temp_id === groupId ? { ...group, ...updates } : group
      ),
    }));
  };

  const addMaterialGroup = () => {
    setFormData((prev) => ({
      ...prev,
      material_groups: [...prev.material_groups, newMaterialGroup()],
    }));
  };

  const removeMaterialGroup = (groupId) => {
    setFormData((prev) => ({
      ...prev,
      material_groups:
        prev.material_groups.length === 1
          ? prev.material_groups
          : prev.material_groups.filter((group) => group.temp_id !== groupId),
    }));
  };

  const addLabourMachineToMaterial = (groupId) => {
    setFormData((prev) => ({
      ...prev,
      material_groups: prev.material_groups.map((group) =>
        group.temp_id === groupId
          ? {
              ...group,
              labour_machine_lines: [...group.labour_machine_lines, newLabourMachineLine()],
            }
          : group
      ),
    }));
  };

  const updateLabourMachineLine = (groupId, lineId, labourId) => {
    setFormData((prev) => ({
      ...prev,
      material_groups: prev.material_groups.map((group) =>
        group.temp_id === groupId
          ? {
              ...group,
              labour_machine_lines: group.labour_machine_lines.map((line) =>
                line.temp_id === lineId ? { ...line, labour_id: labourId } : line
              ),
            }
          : group
      ),
    }));
  };

  const removeLabourMachineLine = (groupId, lineId) => {
    setFormData((prev) => ({
      ...prev,
      material_groups: prev.material_groups.map((group) =>
        group.temp_id === groupId
          ? {
              ...group,
              labour_machine_lines:
                group.labour_machine_lines.length === 1
                  ? group.labour_machine_lines
                  : group.labour_machine_lines.filter((line) => line.temp_id !== lineId),
            }
          : group
      ),
    }));
  };

  const buildRecipeLines = () => {
    const lines = [];

    formData.material_groups.forEach((group) => {
      if (group.material_id) {
        lines.push({
          line_type: 'MATERIAL',
          reference_id: group.material_id,
          qty_driver: 'SQM',
          multiplier: 1,
          waste_percent: 0,
          default_markup_percent: Number(formData.material_markup_percent) || 0,
          markup_allowed: true,
          override_requires_approval: false,
          custom_name: null,
          custom_unit_cost: null,
        });
      }

      group.labour_machine_lines.forEach((line) => {
        const selected = labourMachineById[line.labour_id];

        if (line.labour_id && selected) {
          lines.push({
            line_type: selected.cost_type === 'MACHINE' ? 'MACHINE' : 'LABOUR',
            reference_id: line.labour_id,
            qty_driver: 'SQM',
            multiplier: 1,
            waste_percent: 0,
            default_markup_percent: 0,
            markup_allowed: false,
            override_requires_approval: false,
            custom_name: null,
            custom_unit_cost: null,
          });
        }
      });
    });

    return lines;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canManage) {
      toast.error('Only managers can create recipes');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Recipe name is required');
      return;
    }

    const lines = buildRecipeLines();

    if (lines.length === 0) {
      toast.error('Please add at least one material, labour, or machine item');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        lines,
      };

      if (editingRecipeId) {
        await api.put(`/recipes/${editingRecipeId}`, payload);
        toast.success('Recipe updated');
      } else {
        await api.post('/recipes', payload);
        toast.success('Recipe created');
      }

      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save recipe');
    }
  };

  const handleEdit = (recipe) => {
    const recipeLines = recipe.lines || [];
    const materialLines = recipeLines.filter((line) => line.line_type === 'MATERIAL');
    const labourMachineLines = recipeLines.filter(
      (line) => line.line_type === 'LABOUR' || line.line_type === 'MACHINE'
    );

    const markupPercent =
      materialLines.length > 0
        ? Number(materialLines[0].default_markup_percent) || 0
        : 0;

    const materialGroups = materialLines.length
      ? materialLines.map((line, index) => ({
          temp_id: crypto.randomUUID(),
          material_category: materialById[line.reference_id]?.material_type || 'ALL',
          material_id: line.reference_id || '',
          labour_machine_lines:
            index === 0 && labourMachineLines.length
              ? labourMachineLines.map((labourMachineLine) => ({
                  temp_id: crypto.randomUUID(),
                  labour_id: labourMachineLine.reference_id || '',
                }))
              : [newLabourMachineLine()],
        }))
      : [newMaterialGroup()];

    setEditingRecipeId(recipe.id);
    setFormData({
      name: recipe.name || '',
      material_markup_percent: markupPercent,
      material_groups: materialGroups,
    });
    setDialogOpen(true);
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

  const getRecipeTotals = (recipe) => {
    const lines = recipe.lines || [];

    const materialCost = lines
      .filter((line) => line.line_type === 'MATERIAL')
      .reduce((sum, line) => sum + getMaterialCost(materialById[line.reference_id]), 0);

    const labourMachineCost = lines
      .filter((line) => line.line_type === 'LABOUR' || line.line_type === 'MACHINE')
      .reduce((sum, line) => sum + getLabourMachineCost(labourMachineById[line.reference_id]), 0);

    const markupPercent =
      lines.find((line) => line.line_type === 'MATERIAL')?.default_markup_percent || 0;

    const markupValue = materialCost * ((Number(markupPercent) || 0) / 100);
    const totalSellingPrice = materialCost + labourMachineCost + markupValue;

    return {
      materialCost,
      labourMachineCost,
      markupPercent,
      markupValue,
      totalSellingPrice,
    };
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Recipes</h1>
            <p className="text-slate-600 mt-2">
              Build reusable 1 m² recipes from materials, labour, and machines. Markup applies to materials only.
            </p>
          </div>

          {canManage && (
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

              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingRecipeId ? 'Edit Recipe' : 'Create New 1 m² Recipe'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    This recipe represents <strong>1 m²</strong>. Add materials, then assign one or more labour or machine items to each material.
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="recipe-name">Recipe Name *</Label>
                      <Input
                        id="recipe-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        data-testid="recipe-name-input"
                        placeholder="e.g., ACM panel with vinyl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recipe-markup">Recipe Material Markup %</Label>
                      <Input
                        id="recipe-markup"
                        type="number"
                        step="0.1"
                        value={formData.material_markup_percent}
                        onChange={(e) =>
                          setFormData({ ...formData, material_markup_percent: e.target.value })
                        }
                      />
                      <p className="text-xs text-slate-500">Only materials receive markup.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {formData.material_groups.map((group, groupIndex) => {
                      const availableMaterials =
                        group.material_category === 'ALL'
                          ? materials
                          : materials.filter((item) => item.material_type === group.material_category);

                      const selectedMaterial = materialById[group.material_id];

                      return (
                        <Card key={group.temp_id} className="border-slate-200">
                          <CardContent className="space-y-4 pt-6">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-lg font-bold">Material {groupIndex + 1}</h3>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMaterialGroup(group.temp_id)}
                                disabled={formData.material_groups.length === 1}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 size={16} className="mr-2" />
                                Remove Material
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Material Category</Label>
                                <Select
                                  value={group.material_category}
                                  onValueChange={(value) =>
                                    updateMaterialGroup(group.temp_id, {
                                      material_category: value,
                                      material_id: '',
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MATERIAL_CATEGORIES.map((cat) => (
                                      <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Exact Material</Label>
                                <Select
                                  value={group.material_id || undefined}
                                  onValueChange={(value) =>
                                    updateMaterialGroup(group.temp_id, { material_id: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select material" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableMaterials.map((item) => (
                                      <SelectItem key={item.id} value={item.id}>
                                        {item.name} — {money(getMaterialCost(item))}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                              Material cost: <strong>{money(getMaterialCost(selectedMaterial))}</strong>
                            </div>

                            <div className="space-y-3 rounded-md border border-slate-200 p-4">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">Labour & Machine assigned to this material</h4>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => addLabourMachineToMaterial(group.temp_id)}
                                >
                                  <Plus size={14} className="mr-2" />
                                  Add Labour / Machine
                                </Button>
                              </div>

                              {group.labour_machine_lines.map((line, lineIndex) => {
                                const selectedItem = labourMachineById[line.labour_id];

                                return (
                                  <div key={line.temp_id} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                                    <div className="space-y-2">
                                      <Label>Labour / Machine {lineIndex + 1}</Label>
                                      <Select
                                        value={line.labour_id || undefined}
                                        onValueChange={(value) =>
                                          updateLabourMachineLine(group.temp_id, line.temp_id, value)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select labour or machine" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {labourMachines.map((item) => (
                                            <SelectItem key={item.id} value={item.id}>
                                              {item.cost_type === 'MACHINE' ? 'Machine' : 'Labour'}: {item.name} — {money(getLabourMachineCost(item))}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                                      {money(getLabourMachineCost(selectedItem))}
                                    </div>

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeLabourMachineLine(group.temp_id, line.temp_id)}
                                      disabled={group.labour_machine_lines.length === 1}
                                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    <Button type="button" variant="outline" onClick={addMaterialGroup}>
                      <Plus size={16} className="mr-2" />
                      Add Another Material
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-xl border bg-slate-50 p-4 md:grid-cols-4">
                    <div>
                      <div className="text-xs text-slate-500">Materials Cost</div>
                      <div className="text-lg font-bold">{money(formTotals.materialCost)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Labour & Machine Cost</div>
                      <div className="text-lg font-bold">{money(formTotals.labourMachineCost)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Markup Value</div>
                      <div className="text-lg font-bold">{money(formTotals.markupValue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Total Selling Price</div>
                      <div className="text-xl font-black">{money(formTotals.totalSellingPrice)}</div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" data-testid="recipe-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                      {editingRecipeId ? 'Update Recipe' : 'Create Recipe'}
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
                  Recipes combine material, labour, and machine costs into reusable 1 m² selling prices.
                </div>

                {canManage && (
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
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Recipe Name</th>
                    <th className="px-4 py-3">Materials Cost</th>
                    <th className="px-4 py-3">Labour & Machine Cost</th>
                    <th className="px-4 py-3">Markup %</th>
                    <th className="px-4 py-3">Markup Value</th>
                    <th className="px-4 py-3">Total Selling Price</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {paginatedRecipes.map((recipe) => {
                    const totals = getRecipeTotals(recipe);

                    return (
                      <tr key={recipe.id} data-testid={`recipe-${recipe.id}`}>
                        <td className="px-4 py-3 font-semibold">{recipe.name}</td>
                        <td className="px-4 py-3">{money(totals.materialCost)}</td>
                        <td className="px-4 py-3">{money(totals.labourMachineCost)}</td>
                        <td className="px-4 py-3">{Number(totals.markupPercent || 0).toFixed(1)}%</td>
                        <td className="px-4 py-3">{money(totals.markupValue)}</td>
                        <td className="px-4 py-3 font-bold">{money(totals.totalSellingPrice)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setInfoRecipe(recipe)}>
                              <Info size={16} />
                            </Button>

                            {canManage && (
                              <>
                                <Button type="button" variant="ghost" size="sm" onClick={() => handleEdit(recipe)}>
                                  <Edit size={16} />
                                </Button>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(recipe.id)}
                                  data-testid={`delete-recipe-${recipe.id}`}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {filteredRecipes.length === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredRecipes.length)} of {filteredRecipes.length} recipes
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

                <span>Page {currentPage} of {totalPages}</span>

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

        <Dialog open={!!infoRecipe} onOpenChange={(open) => !open && setInfoRecipe(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Recipe Information</DialogTitle>
            </DialogHeader>

            {infoRecipe && (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-slate-500">Recipe Name</div>
                  <div className="text-lg font-bold">{infoRecipe.name}</div>
                </div>

                <div className="space-y-2">
                  {(infoRecipe.lines || []).map((line, index) => {
                    const material = line.line_type === 'MATERIAL' ? materialById[line.reference_id] : null;
                    const labourMachine =
                      line.line_type === 'LABOUR' || line.line_type === 'MACHINE'
                        ? labourMachineById[line.reference_id]
                        : null;

                    return (
                      <div key={index} className="rounded-md border p-3 text-sm">
                        <div className="font-semibold">{line.line_type}</div>
                        <div>{material?.name || labourMachine?.name || line.custom_name || 'Unknown item'}</div>
                        <div className="text-slate-500">
                          {line.line_type === 'MATERIAL'
                            ? money(getMaterialCost(material))
                            : money(getLabourMachineCost(labourMachine))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
