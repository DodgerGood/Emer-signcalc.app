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
import { Plus, Trash2, Package, Droplet, Users } from 'lucide-react';
import { toast } from 'sonner';

const LINE_TYPES = ['MATERIAL', 'INK', 'SPRAY_CONSUMABLE', 'LABOUR', 'SPRAY_LABOUR'];
const QTY_DRIVERS = ['SQM', 'HOURS', 'PER_JOB'];

export default function RecipesPage() {
  const { isManager } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [inks, setInks] = useState([]);
  const [labours, setLabours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', lines: [] });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [recipesRes, materialsRes, inksRes, laboursRes] = await Promise.all([
        api.get('/recipes'),
        api.get('/materials'),
        api.get('/ink-profiles'),
        api.get('/labour-types')
      ]);
      setRecipes(recipesRes.data);
      setMaterials(materialsRes.data);
      setInks(inksRes.data);
      setLabours(laboursRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, {
        line_type: 'MATERIAL',
        reference_id: '',
        qty_driver: 'SQM',
        multiplier: 1,
        waste_percent: 0,
        default_markup_percent: 30,
        markup_allowed: true,
        override_requires_approval: false,
        custom_name: ''
      }]
    });
  };

  const updateLine = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index][field] = value;
    setFormData({ ...formData, lines: newLines });
  };

  const removeLine = (index) => {
    setFormData({ ...formData, lines: formData.lines.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isManager()) {
      toast.error('Only managers can create recipes');
      return;
    }
    try {
      await api.post('/recipes', formData);
      toast.success('Recipe created');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create recipe');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recipe?')) return;
    try {
      await api.delete(`/recipes/${id}`);
      toast.success('Recipe deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete recipe');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', lines: [] });
  };

  const getRefOptions = (lineType) => {
    switch (lineType) {
      case 'MATERIAL': return materials;
      case 'INK': return inks;
      case 'LABOUR':
      case 'SPRAY_LABOUR': return labours;
      default: return [];
    }
  };

  const getLineIcon = (type) => {
    switch (type) {
      case 'MATERIAL': return <Package size={16} />;
      case 'INK': return <Droplet size={16} />;
      case 'LABOUR':
      case 'SPRAY_LABOUR': return <Users size={16} />;
      default: return null;
    }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Recipes</h1>
            <p className="text-slate-600 mt-2">Pricing assemblies for quotes</p>
          </div>
          {isManager() && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} data-testid="add-recipe-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
                  <Plus size={18} className="mr-2" />New Recipe
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create New Recipe</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="recipe-name">Recipe Name *</Label>
                    <Input id="recipe-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="recipe-name-input" placeholder="e.g., Standard Banner Print" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold">Recipe Lines</h3>
                      <Button type="button" size="sm" onClick={addLine} data-testid="add-recipe-line-btn" variant="outline">
                        <Plus size={16} className="mr-2" />Add Line
                      </Button>
                    </div>
                    {formData.lines.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">No lines yet. Add your first line item above.</p>
                    ) : (
                      formData.lines.map((line, index) => (
                        <Card key={index} className="p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Line Type</Label>
                              <Select value={line.line_type} onValueChange={(v) => updateLine(index, 'line_type', v)}>
                                <SelectTrigger data-testid={`line-${index}-type`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {LINE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {['MATERIAL', 'INK', 'LABOUR', 'SPRAY_LABOUR', 'INSTALL'].includes(line.line_type) && (
                              <div className="space-y-2">
                                <Label>Reference</Label>
                                <Select value={line.reference_id} onValueChange={(v) => updateLine(index, 'reference_id', v)}>
                                  <SelectTrigger data-testid={`line-${index}-ref`}><SelectValue placeholder="Select..." /></SelectTrigger>
                                  <SelectContent>
                                    {getRefOptions(line.line_type).map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label>Qty Driver</Label>
                              <Select value={line.qty_driver} onValueChange={(v) => updateLine(index, 'qty_driver', v)}>
                                <SelectTrigger data-testid={`line-${index}-driver`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {QTY_DRIVERS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Multiplier</Label>
                              <Input type="number" step="0.01" value={line.multiplier} onChange={(e) => updateLine(index, 'multiplier', parseFloat(e.target.value) || 0)} data-testid={`line-${index}-multiplier`} />
                            </div>
                            <div className="space-y-2">
                              <Label>Waste %</Label>
                              <Input type="number" step="0.1" value={line.waste_percent} onChange={(e) => updateLine(index, 'waste_percent', parseFloat(e.target.value) || 0)} data-testid={`line-${index}-waste`} />
                            </div>
                            <div className="space-y-2">
                              <Label>Default Markup %</Label>
                              <Input type="number" step="0.1" value={line.default_markup_percent} onChange={(e) => updateLine(index, 'default_markup_percent', parseFloat(e.target.value) || 0)} data-testid={`line-${index}-markup`} />
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                              <input type="checkbox" id={`markup-${index}`} checked={line.markup_allowed} onChange={(e) => updateLine(index, 'markup_allowed', e.target.checked)} data-testid={`line-${index}-markup-allowed`} />
                              <Label htmlFor={`markup-${index}`} className="text-sm">Markup Allowed</Label>
                            </div>
                            <div className="flex items-center space-x-2 pt-6">
                              <input type="checkbox" id={`approval-${index}`} checked={line.override_requires_approval} onChange={(e) => updateLine(index, 'override_requires_approval', e.target.checked)} data-testid={`line-${index}-approval-required`} />
                              <Label htmlFor={`approval-${index}`} className="text-sm">Override Requires Approval</Label>
                            </div>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(index)} data-testid={`remove-line-${index}`} className="text-red-600 hover:text-red-700">
                              <Trash2 size={16} className="mr-2" />Remove
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit" data-testid="recipe-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">Create Recipe</Button>
                    <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>
        ) : recipes.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                <div className="text-lg font-semibold text-slate-900">
                  No recipes added yet
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Recipes combine your costing inputs into reusable pricing structures for quotes.
                </div>

                {isManager() && (
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    data-testid="add-recipe-btn"
                    className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                  >
                    Add your first recipe
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((recipe) => (
              <Card key={recipe.id} className="card-technical" data-testid={`recipe-${recipe.id}`}>
                <CardHeader>
                  <CardTitle className="flex justify-between items-start">
                    <span className="text-lg">{recipe.name}</span>
                    <span className="text-xs text-slate-500 font-mono">v{recipe.version}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recipe.lines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                        {getLineIcon(line.line_type)}
                        <span>{line.line_type}</span>
                        <span className="text-xs text-slate-400">({line.qty_driver})</span>
                      </div>
                    ))}
                  </div>
                  {isManager() && (
                    <div className="mt-4 pt-4 border-t">
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(recipe.id)} data-testid={`delete-recipe-${recipe.id}`} className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full">
                        <Trash2 size={16} className="mr-2" />Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
