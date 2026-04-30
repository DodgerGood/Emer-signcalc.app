import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function LabourTypesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const importFileRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    cost_type: 'LABOUR',
    name: '',
    category: 'GENERAL',
    rate_per_hour: '',
    number_of_people: '1',
    sqm_per_hour: '',
    tools: [],
    machine_dimensions: '',
    machine_watts: '',
    electricity_cost_per_kwh: '',
    setup_time_minutes: '',
    waste_factor_percent: '',
    operator_hourly_rate: '',
    machine_value: '',
    depreciation_years: '',
    working_hours_per_year: '',
  });

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const handleExportLabourTypes = async () => {
    try {
      const response = await api.get('/labour-types/export', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'labour_types_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Labour types export downloaded');
    } catch (error) {
      toast.error('Failed to export labour types');
    }
  };

  const handleImportLabourTypes = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await api.post('/labour-types/import', formDataUpload, {
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
        console.log('Labour type import errors:', result.errors);
      }

      loadItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import labour types');
    } finally {
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  const addTool = () => {
    setFormData({
      ...formData,
      tools: [...(formData.tools || []), { name: '', quantity: 1, cost_per_hour: 0 }]
    });
  };

  const updateTool = (index, field, value) => {
    const updated = [...formData.tools];
    updated[index][field] = value;
    setFormData({ ...formData, tools: updated });
  };

  const removeTool = (index) => {
    if (
      !window.confirm(
        'Removing this tool will affect the costing of this labour type and every recipe where it is used.\n\nClick OK to remove this tool.'
      )
    ) return;

    const updated = [...formData.tools];
    updated.splice(index, 1);
    setFormData({ ...formData, tools: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const machineValue = parseFloat(formData.machine_value) || 0;
      const depreciationYears = parseFloat(formData.depreciation_years) || 0;
      const workingHoursPerYear = parseFloat(formData.working_hours_per_year) || 0;

      const autoMachineRate =
        depreciationYears > 0 && workingHoursPerYear > 0
          ? machineValue / depreciationYears / workingHoursPerYear
          : 0;

      const data = {
        cost_type: formData.cost_type,
        name: formData.name,
        category: formData.category,
        rate_per_hour:
          formData.cost_type === 'MACHINE'
            ? autoMachineRate
            : parseFloat(formData.rate_per_hour),
        number_of_people:
          formData.cost_type === 'MACHINE'
            ? 1
            : parseInt(formData.number_of_people),
        sqm_per_hour: formData.sqm_per_hour ? parseFloat(formData.sqm_per_hour) : null,
        machine_dimensions: formData.machine_dimensions || null,
        machine_watts: formData.machine_watts ? parseFloat(formData.machine_watts) : null,
        electricity_cost_per_kwh: formData.electricity_cost_per_kwh ? parseFloat(formData.electricity_cost_per_kwh) : null,
        setup_time_minutes: formData.setup_time_minutes ? parseFloat(formData.setup_time_minutes) : null,
        waste_factor_percent: formData.waste_factor_percent ? parseFloat(formData.waste_factor_percent) : null,
        operator_hourly_rate: formData.operator_hourly_rate ? parseFloat(formData.operator_hourly_rate) : null,
        machine_value: formData.machine_value ? parseFloat(formData.machine_value) : null,
        depreciation_years: formData.depreciation_years ? parseFloat(formData.depreciation_years) : null,
        working_hours_per_year: formData.working_hours_per_year ? parseFloat(formData.working_hours_per_year) : null,
        tools: (formData.tools || []).map((tool) => ({
          name: tool.name,
          quantity: parseFloat(tool.quantity) || 0,
          cost_per_hour: parseFloat(tool.cost_per_hour) || 0,
        })),
      };

      if (editingId) {
        await api.put(`/labour-types/${editingId}`, data);
        toast.success('Cost type updated');
      } else {
        await api.post('/labour-types', data);
        toast.success('Cost type created');
      }

      setDialogOpen(false);
      resetForm();
      loadItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Operation failed');
    }
  };

  const handleEdit = (item) => {
    if (
      !window.confirm(
        'Editing this item will affect the costing of every recipe where it is used.\n\nClick OK to continue editing this item.'
      )
    ) return;

    setEditingId(item.id);
    setFormData({
      cost_type: item.cost_type || 'LABOUR',
      name: item.name || '',
      category: item.category || 'GENERAL',
      rate_per_hour: item.rate_per_hour?.toString() || '',
      number_of_people: item.number_of_people?.toString() || '1',
      sqm_per_hour: item.sqm_per_hour?.toString() || '',
      tools: item.tools || [],
      machine_dimensions: item.machine_dimensions || '',
      machine_watts: item.machine_watts?.toString() || '',
      electricity_cost_per_kwh: item.electricity_cost_per_kwh?.toString() || '',
      setup_time_minutes: item.setup_time_minutes?.toString() || '',
      waste_factor_percent: item.waste_factor_percent?.toString() || '',
      operator_hourly_rate: item.operator_hourly_rate?.toString() || '',
      machine_value: item.machine_value?.toString() || '',
      depreciation_years: item.depreciation_years?.toString() || '',
      working_hours_per_year: item.working_hours_per_year?.toString() || '',
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
    if (
      !window.confirm(
        'Deleting this item will affect your recipe builds. Any recipe using this labour type may become incomplete or cost incorrectly.\n\nClick OK to permanently delete this item.'
      )
    ) return;

    try {
      await api.delete(`/labour-types/${id}`);
      toast.success('Labour type deleted');
      loadItems();
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

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      cost_type: 'LABOUR',
      name: '',
      category: 'GENERAL',
      rate_per_hour: '',
      number_of_people: '1',
      sqm_per_hour: '',
      tools: [],
      machine_value: '',
      depreciation_years: '',
      working_hours_per_year: '',
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Labour & Machine Pricelist</h1>
            <p className="text-slate-600 mt-2">Manage labour rates and costing categories (ZAR)</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportLabourTypes}
              data-testid="import-labour-types-file-input"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => importFileRef.current?.click()}
              data-testid="import-labour-types-btn"
              className="border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              Import Labour CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportLabourTypes}
              data-testid="export-labour-types-btn"
            >
              Export Labour CSV
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleOpenCreate}
                  data-testid="add-labour-btn"
                  className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={18} className="mr-2" />
                  Add Cost Type
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Cost Type' : 'Add New Cost Type'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Cost Type</Label>
                    <Select
                      value={formData.cost_type}
                      onValueChange={(v) => setFormData({ ...formData, cost_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LABOUR">Labour</SelectItem>
                        <SelectItem value="MACHINE">Machine Time</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Select whether this is labour work or machine production time.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      {formData.cost_type === 'MACHINE' ? 'Machine Name *' : 'Labour Type *'}
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="labour-name-input"
                      placeholder={formData.cost_type === 'MACHINE' ? 'e.g., CNC Router' : 'e.g., Vinyl Application'}
                    />
                    <p className="text-xs text-slate-500">
                      Name of the labour activity (e.g., Vinyl Application, Welding, Installation).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={formData.category || 'GENERAL'}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="APPLICATION">Application</SelectItem>
                        <SelectItem value="FABRICATION">Fabrication</SelectItem>
                        <SelectItem value="PRINTING">Printing</SelectItem>
                        <SelectItem value="MACHINE">Machine</SelectItem>
                        <SelectItem value="INSTALLATION">Installation</SelectItem>
                        <SelectItem value="GENERAL">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Group this labour type for reporting and filtering.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {formData.cost_type === 'LABOUR' && (
                      <div className="space-y-2 w-full">
                        <Label htmlFor="rate">Rate per Hour (ZAR) *</Label>
                        <Input
                          id="rate"
                          type="number"
                          step="0.01"
                          value={formData.rate_per_hour}
                          onChange={(e) => setFormData({ ...formData, rate_per_hour: e.target.value })}
                          required
                          data-testid="labour-rate-input"
                        />
                        <p className="text-xs text-slate-500">
                          Cost per person per hour (before team multiplication).
                        </p>
                      </div>
                    )}

                    {formData.cost_type === 'LABOUR' && (
                      <div className="space-y-2">
                        <Label htmlFor="number_of_people">Number of People *</Label>
                        <Input
                          id="number_of_people"
                          type="number"
                          value={formData.number_of_people}
                          onChange={(e) => setFormData({ ...formData, number_of_people: e.target.value })}
                          required
                          data-testid="labour-people-input"
                        />
                        <p className="text-xs text-slate-500">
                          Number of workers required for this task.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2 w-full">
                      <Label htmlFor="sqm_per_hour">m² per Hour</Label>
                      <Input
                        id="sqm_per_hour"
                        type="number"
                        step="0.01"
                        value={formData.sqm_per_hour}
                        onChange={(e) => setFormData({ ...formData, sqm_per_hour: e.target.value })}
                        placeholder="e.g., 12"
                      />
                      <p className="text-xs text-slate-500">
                        How many square meters this team can complete per hour.
                      </p>
                    </div>
                    {formData.cost_type === 'MACHINE' && (
                      <div className="md:col-span-2 w-full bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Machine Value (ZAR)</Label>
                            <Input
                              type="number"
                              value={formData.machine_value}
                              onChange={(e) => setFormData({ ...formData, machine_value: e.target.value })}
                              placeholder="e.g., 250000"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Depreciation Years</Label>
                            <Input
                              type="number"
                              value={formData.depreciation_years}
                              onChange={(e) => setFormData({ ...formData, depreciation_years: e.target.value })}
                              placeholder="e.g., 5"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Working Hours per Year</Label>
                            <Input
                              type="number"
                              value={formData.working_hours_per_year}
                              onChange={(e) => setFormData({ ...formData, working_hours_per_year: e.target.value })}
                              placeholder="e.g., 2000"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Machine Dimensions</Label>
                            <Input
                              value={formData.machine_dimensions}
                              onChange={(e) => setFormData({ ...formData, machine_dimensions: e.target.value })}
                              placeholder="e.g., 1600mm print width"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Machine Watts</Label>
                            <Input
                              type="number"
                              value={formData.machine_watts}
                              onChange={(e) => setFormData({ ...formData, machine_watts: e.target.value })}
                              placeholder="e.g., 2500"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Electricity Cost per kWh</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.electricity_cost_per_kwh}
                              onChange={(e) => setFormData({ ...formData, electricity_cost_per_kwh: e.target.value })}
                              placeholder="e.g., 2.50"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Setup Time (minutes)</Label>
                            <Input
                              type="number"
                              value={formData.setup_time_minutes}
                              onChange={(e) => setFormData({ ...formData, setup_time_minutes: e.target.value })}
                              placeholder="e.g., 15"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Waste Factor (%)</Label>
                            <Input
                              type="number"
                              value={formData.waste_factor_percent}
                              onChange={(e) => setFormData({ ...formData, waste_factor_percent: e.target.value })}
                              placeholder="e.g., 5"
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label>Operator Hourly Rate</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.operator_hourly_rate}
                              onChange={(e) => setFormData({ ...formData, operator_hourly_rate: e.target.value })}
                              placeholder="e.g., 120"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                  {formData.cost_type === 'LABOUR' && (
                    <div className="space-y-2 w-full">
                      <Label>Tools</Label>

                      {(formData.tools || []).map((tool, index) => (
                        <div key={index} className="grid grid-cols-4 gap-2 items-center">
                          <Input
                            placeholder="e.g., Heat Gun"
                            value={tool.name}
                            onChange={(e) => updateTool(index, 'name', e.target.value)}
                          />
                          <p className="text-xs text-slate-500">
                            Add tools used and their hourly cost contribution.
                          </p>
                          <Input
                            type="number"
                            placeholder="Qty used"
                            value={tool.quantity}
                            onChange={(e) => updateTool(index, 'quantity', e.target.value)}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Cost per hour (ZAR)"
                            value={tool.cost_per_hour}
                            onChange={(e) => updateTool(index, 'cost_per_hour', e.target.value)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => removeTool(index)}
                            className="bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}

                      <Button type="button" variant="outline" onClick={addTool}>
                        + Add Tool
                      </Button>
                    </div>
                  )}

                  {(() => {
                    const labourRate =
                      (parseFloat(formData.rate_per_hour) || 0) * 
                      (parseInt(formData.number_of_people || '1') || 1);

                    const toolsRate = (formData.tools || []).reduce((sum, tool) => {
                      const qty = parseFloat(tool.quantity) || 0;
                      const cost = parseFloat(tool.cost_per_hour) || 0;
                      return sum + qty * cost;
                    }, 0);

                    const machineValue = parseFloat(formData.machine_value) || 0;
                    const depreciationYears = parseFloat(formData.depreciation_years) || 0;
                    const hoursPerYear = parseFloat(formData.working_hours_per_year) || 0;

                    const autoMachineRate =
                      depreciationYears > 0 && hoursPerYear > 0
                        ? machineValue / depreciationYears / hoursPerYear
                        : 0;

                    const manualRate = parseFloat(formData.rate_per_hour) || 0;

                    const machineRate = autoMachineRate > 0 ? autoMachineRate : manualRate;

                    const watts = parseFloat(formData.machine_watts) || 0;
                    const electricityCost = parseFloat(formData.electricity_cost_per_kwh) || 0;
                    const electricityPerHour = (watts / 1000) * electricityCost;

                    const operatorRate = parseFloat(formData.operator_hourly_rate) || 0;

                    let totalRate = 0;

                    if (formData.cost_type === 'LABOUR') {
                      totalRate = labourRate + toolsRate;
                    } else {
                      totalRate = machineRate + electricityPerHour + operatorRate;
                    }

                    const sqmPerHour = parseFloat(formData.sqm_per_hour) || 0;
                    const costPerSqm = sqmPerHour > 0 ? totalRate / sqmPerHour : null;

                    return (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
                        {formData.cost_type === 'LABOUR' ? (
                          <>
                            <div>Labour team cost/hour: R {labourRate.toFixed(2)}</div>
                            <div>Tools cost/hour: R {toolsRate.toFixed(2)}</div>

                            <div className="font-semibold text-green-700">
                              Total labour + tools/hour: R {totalRate.toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              Machine cost/hour: R {machineRate.toFixed(2)}
                              {autoMachineRate > 0 ? ' (auto-calculated)' : ' (manual)'}
                            </div>
                            <div>Electricity/hour: R {electricityPerHour.toFixed(2)}</div>
                            <div>Operator/hour: R {operatorRate.toFixed(2)}</div>

                            <div className="font-semibold text-green-700">
                              Total machine cost/hour: R {totalRate.toFixed(2)}
                            </div>
                          </>
                        )}

                        {costPerSqm !== null && (
                          <div className="font-semibold text-blue-700">
                            Cost per m²: R {costPerSqm.toFixed(2)}
                          </div>
                        )}
                     </div>
                    );
                  })()}

                  {formData.rate_per_hour && formData.number_of_people && (
                    <div className="text-sm text-green-600 font-medium">
                      Team rate per hour: R {
                        (
                          parseFloat(formData.rate_per_hour) *
                          parseInt(formData.number_of_people || '1')
                        ).toFixed(2)
                      }
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      data-testid="labour-submit-btn"
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
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Use the exported CSV as your template. Matching names update existing labour types, new names are added.
        </p>

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-sm space-y-2">
            <Label htmlFor="labour-search">Search Labour Types</Label>
            <Input
              id="labour-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or category"
              data-testid="labour-search-input"
            />
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
                    <TableHead>Category</TableHead>
                    <TableHead className="data-mono">Cost / m² (ZAR)</TableHead>
                    <TableHead className="data-mono">Type</TableHead>
                    <TableHead className="data-mono">Hourly Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                          <div className="text-lg font-semibold text-slate-900">
                            No labour rates found
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            Try adjusting your search, or add a new labour type.
                          </div>

                          <button
                            type="button"
                            onClick={handleOpenCreate}
                            data-testid="add-first-labour-btn"
                            className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                          >
                            Add your first labour rate
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item) => {
                      const isMachine = item.cost_type === 'MACHINE';

                      const machineValue = Number(item.machine_value) || 0;
                      const depreciationYears = Number(item.depreciation_years) || 0;
                      const workingHoursPerYear = Number(item.working_hours_per_year) || 0;

                      const autoMachineRate =
                        depreciationYears > 0 && workingHoursPerYear > 0
                          ? machineValue / depreciationYears / workingHoursPerYear
                          : null;

                      const manualRate = Number(item.rate_per_hour) || 0;

                      const hourlyRate = isMachine
                        ? (autoMachineRate !== null ? autoMachineRate : manualRate)
                        : manualRate;
                      const people = Number(item.number_of_people) || 1;
                      const sqmPerHour = Number(item.sqm_per_hour) || 0;

                      const toolsRate = (item.tools || []).reduce((sum, tool) => {
                        return sum + ((Number(tool.quantity) || 0) * (Number(tool.cost_per_hour) || 0));
                      }, 0);

                      const electricityPerHour =
                        ((Number(item.machine_watts) || 0) / 1000) *  
                        (Number(item.electricity_cost_per_kwh) || 0);

                      const operatorRate = Number(item.operator_hourly_rate) || 0;

                      const hourlyTotal = isMachine
                        ? hourlyRate + electricityPerHour + operatorRate 
                        : (Number(item.rate_per_hour) || 0) * people + toolsRate;

                      const costPerSqm = sqmPerHour > 0 ? hourlyTotal / sqmPerHour : null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.category || '-'}</TableCell>
                          <TableCell className="data-mono">
                            {costPerSqm !== null ? `R ${costPerSqm.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="data-mono">
                            {isMachine ? 'Machine' : 'Labour'}
                          </TableCell>
                          <TableCell className="data-mono">
                            R {hourlyTotal.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShowUsage(item.id)}
                              title="Show recipe usage"
                            >
                              <Info size={16} />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                            >
                              <Pencil size={16} />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
              <div>
                Showing {filteredItems.length === 0 ? 0 : startIndex + 1} to{' '}
                {Math.min(startIndex + itemsPerPage, filteredItems.length)} of{' '}
                {filteredItems.length} labour types
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
