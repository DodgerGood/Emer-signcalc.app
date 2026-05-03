import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Pencil, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function InstallTypesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const importFileRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    name: '',
    quantity_of_people: '2',
    rate_per_hour: '',
    sqm_per_hour: '',
    tools: [],
    hire_machine_name: '',
    hire_machine_supplier: '',
    hire_machine_rate_per_hour: '',
  });

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadItems = async () => {
    try {
      const response = await api.get('/install-types');
      setItems(response.data);
    } catch {
      toast.error('Failed to load installation types');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.hire_machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.hire_machine_supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const handleExportInstallTypes = async () => {
    try {
      const response = await api.get('/install-types/export', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'install_types_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Installation export downloaded');
    } catch {
      toast.error('Failed to export installation types');
    }
  };

  const handleImportInstallTypes = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await api.post('/install-types/import', formDataUpload, {
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
        console.log('Installation import errors:', result.errors);
      }

      loadItems();
    } catch (error) {
      console.log('Install submit error:', error.response?.data || error);

      toast.error(
        typeof error.response?.data?.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response?.data?.detail || error.message || 'Operation failed')
      );
    } finally {
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  const addTool = () => {
    setFormData({
      ...formData,
      tools: [...(formData.tools || []), { name: '', quantity: 1, cost_per_hour: 0 }],
    });
  };

  const updateTool = (index, field, value) => {
    const updated = [...(formData.tools || [])];
    updated[index][field] = value;
    setFormData({ ...formData, tools: updated });
  };

  const removeTool = (index) => {
    if (
      !window.confirm(
        'Removing this tool will affect the costing of this installation type and every recipe where it is used.\n\nClick OK to remove this tool.'
      )
    ) return;

    const updated = [...(formData.tools || [])];
    updated.splice(index, 1);
    setFormData({ ...formData, tools: updated });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      quantity_of_people: '2',
      rate_per_hour: '',
      sqm_per_hour: '',
      tools: [],
      hire_machine_name: '',
      hire_machine_supplier: '',
      hire_machine_rate_per_hour: '',
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const data = {
        name: formData.name,
        quantity_of_people: parseInt(formData.quantity_of_people),
        rate_per_hour: parseFloat(formData.rate_per_hour),
        sqm_per_hour: formData.sqm_per_hour ? parseFloat(formData.sqm_per_hour) : null,
        tools: (formData.tools || []).map((tool) => ({
          name: tool.name,
          quantity: parseFloat(tool.quantity) || 0,
          cost_per_hour: parseFloat(tool.cost_per_hour) || 0,
        })),
        hire_machine_name: formData.hire_machine_name || null,
        hire_machine_supplier: formData.hire_machine_supplier || null,
        hire_machine_rate_per_hour: formData.hire_machine_rate_per_hour
          ? parseFloat(formData.hire_machine_rate_per_hour)
          : null,
      };

      if (editingId) {
        await api.put(`/install-types/${editingId}`, data);
        toast.success('Installation type updated');
      } else {
        await api.post('/install-types', data);
        toast.success('Installation type created');
      }

      setDialogOpen(false);
      resetForm();
      loadItems();
    } catch (error) {
      console.log('Install submit error:', error.response?.data || error);
      toast.error(
        typeof error.response?.data?.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response?.data?.detail || 'Operation failed')
      );
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
      name: item.name || '',
      quantity_of_people: item.quantity_of_people?.toString() || '2',
      rate_per_hour: item.rate_per_hour?.toString() || '',
      sqm_per_hour: item.sqm_per_hour?.toString() || '',
      tools: item.tools || [],
      hire_machine_name: item.hire_machine_name || '',
      hire_machine_supplier: item.hire_machine_supplier || '',
      hire_machine_rate_per_hour: item.hire_machine_rate_per_hour?.toString() || '',
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
        'Deleting this item will affect your recipe builds. Any recipe using this installation type may become incomplete or cost incorrectly.\n\nClick OK to permanently delete this item.'
      )
    ) return;

    try {
      await api.delete(`/install-types/${id}`);
      toast.success('Installation type deleted');
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

  const calculateItemCost = (item) => {
    const people = Number(item.quantity_of_people) || 1;
    const labourRate = (Number(item.rate_per_hour) || 0) * people;

    const toolsRate = (item.tools || []).reduce((sum, tool) => {
      return sum + ((Number(tool.quantity) || 0) * (Number(tool.cost_per_hour) || 0));
    }, 0);

    const hireMachineRate = Number(item.hire_machine_rate_per_hour) || 0;
    const hourlyTotal = labourRate + toolsRate + hireMachineRate;

    const sqmPerHour = Number(item.sqm_per_hour) || 0;
    const costPerSqm = sqmPerHour > 0 ? hourlyTotal / sqmPerHour : null;

  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Installation Pricelist</h1>
            <p className="text-slate-600 mt-2">Manage installation rates, tools, travel, and hire equipment.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <input
              ref={importFileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportInstallTypes}
              data-testid="import-install-types-file-input"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => importFileRef.current?.click()}
              data-testid="import-install-types-btn"
              className="border-slate-300 text-slate-700 bg-slate-100 hover:bg-slate-200"
            >
              Import Installation CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportInstallTypes}
              data-testid="export-install-types-btn"
            >
              Export Installation CSV
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={handleOpenCreate}
                  data-testid="add-install-btn"
                  className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={18} className="mr-2" />
                  Add Installation Type
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? 'Edit Installation Type' : 'Add New Installation Type'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Installation Type *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="install-name-input"
                      placeholder="e.g., On-site vinyl installation"
                    />
                    <p className="text-xs text-slate-500">Name of the installation activity.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quantity_of_people">Number of People *</Label>
                      <Input
                        id="quantity_of_people"
                        type="number"
                        value={formData.quantity_of_people}
                        onChange={(e) => setFormData({ ...formData, quantity_of_people: e.target.value })}
                        required
                        data-testid="install-people-input"
                      />
                      <p className="text-xs text-slate-500">Number of installers required for this installation type.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rate_per_hour">Rate per Hour (ZAR) *</Label>
                      <Input
                        id="rate_per_hour"
                        type="number"
                        step="0.01"
                        value={formData.rate_per_hour}
                        onChange={(e) => setFormData({ ...formData, rate_per_hour: e.target.value })}
                        required
                        data-testid="install-rate-input"
                      />
                      <p className="text-xs text-slate-500">Cost per person per hour.</p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="sqm_per_hour">m² per Hour</Label>
                      <Input
                        id="sqm_per_hour"
                        type="number"
                        step="0.01"
                        value={formData.sqm_per_hour}
                        onChange={(e) => setFormData({ ...formData, sqm_per_hour: e.target.value })}
                        placeholder="e.g., 8"
                      />
                      <p className="text-xs text-slate-500">
                        How many square meters the full installation team can complete per hour, based on the number of people entered above.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 w-full">
                    <Label>Tools</Label>

                    {(formData.tools || []).map((tool, index) => (
                      <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-4 md:items-start">
                        <div className="space-y-1">
                          <Input
                            placeholder="e.g., Ladder"
                            value={tool.name}
                            onChange={(e) => updateTool(index, 'name', e.target.value)}
                          />
                          <p className="text-xs text-slate-500">Tool name.</p>
                        </div>

                        <div className="space-y-1">
                          <Input
                            type="number"
                            placeholder="Qty used"
                            value={tool.quantity}
                            onChange={(e) => updateTool(index, 'quantity', e.target.value)}
                          />
                          <p className="text-xs text-slate-500">How many of this tool are used.</p>
                        </div>

                        <div className="space-y-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Cost per hour (ZAR)"
                            value={tool.cost_per_hour}
                            onChange={(e) => updateTool(index, 'cost_per_hour', e.target.value)}
                          />
                          <p className="text-xs text-slate-500">Hourly cost contribution for this tool.</p>
                        </div>

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

                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                    <h3 className="font-semibold text-slate-900">Hire Machine / Equipment</h3>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Hire Machine / Equipment</Label>
                        <Input
                          value={formData.hire_machine_name}
                          onChange={(e) => setFormData({ ...formData, hire_machine_name: e.target.value })}
                          placeholder="e.g., Cherry picker"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Supplier</Label>
                        <Input
                          value={formData.hire_machine_supplier}
                          onChange={(e) => setFormData({ ...formData, hire_machine_supplier: e.target.value })}
                          placeholder="e.g., ABC Hire"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Hire Rate per Hour (ZAR)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.hire_machine_rate_per_hour}
                          onChange={(e) => setFormData({ ...formData, hire_machine_rate_per_hour: e.target.value })}
                          placeholder="e.g., 450"
                        />
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const people = parseInt(formData.quantity_of_people || '1') || 1;
                    const labourRate = (parseFloat(formData.rate_per_hour) || 0) * people;

                    const toolsRate = (formData.tools || []).reduce((sum, tool) => {
                      return sum + ((parseFloat(tool.quantity) || 0) * (parseFloat(tool.cost_per_hour) || 0));
                    }, 0);

                    const hireRate = parseFloat(formData.hire_machine_rate_per_hour) || 0;
                    const totalHourly = labourRate + toolsRate + hireRate;

                    const sqmPerHour = parseFloat(formData.sqm_per_hour) || 0;
                    const costPerSqm = sqmPerHour > 0 ? totalHourly / sqmPerHour : null;

                    const travelCost =
                      (parseFloat(formData.travel_km) || 0) *
                      (parseFloat(formData.travel_rate_per_km) || 0);

                    return (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-1">
                        <div>Installation labour/hour: R {labourRate.toFixed(2)}</div>
                        <div>Tools/hour: R {toolsRate.toFixed(2)}</div>
                        <div>Hire machine/hour: R {hireRate.toFixed(2)}</div>
                        <div className="font-semibold text-green-700">
                          Total installation/hour: R {totalHourly.toFixed(2)}
                        </div>

                        {costPerSqm !== null && (
                          <div className="font-semibold text-blue-700">
                            Cost per m²: R {costPerSqm.toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-2 pt-4">
                    <Button type="submit" data-testid="install-submit-btn" className="bg-[#2563EB] hover:bg-[#1e40af]">
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

        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-sm space-y-2">
            <Label htmlFor="install-search">Search Installation Types</Label>
            <Input
              id="install-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by installation, machine, or supplier"
              data-testid="install-search-input"
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
                    <TableHead className="w-[25%]">Name</TableHead>
                      <TableHead className="data-mono w-[20%]">Cost / m²</TableHead>
                      <TableHead className="data-mono w-[15%]">m² / hr</TableHead>
                      <TableHead className="w-[25%]">Hire Machine</TableHead>
                      <TableHead className="text-right w-[15%]">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                          <div className="text-lg font-semibold text-slate-900">No installation rates found</div>
                          <div className="mt-2 text-sm text-slate-600">
                            Try adjusting your search, or add a new installation type.
                          </div>

                          <button
                            type="button"
                            onClick={handleOpenCreate}
                            data-testid="add-first-install-btn"
                            className="mt-4 inline-flex items-center rounded bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                          >
                            Add your first installation rate
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedItems.map((item) => {
                    const { costPerSqm } = calculateItemCost(item);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium truncate max-w-[180px]">
                            {item.name}
                          </TableCell>
                          <TableCell className="data-mono">
                            {costPerSqm !== null ? `R ${costPerSqm.toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="data-mono">{item.sqm_per_hour || '-'}</TableCell>
                          <TableCell className="text-sm truncate max-w-[180px]">
                            {item.hire_machine_name || '-'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button variant="ghost" size="sm" onClick={() => handleShowUsage(item.id)} title="Show recipe usage">
                              <Info size={16} />
                            </Button>

                            <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
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
                {Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} installation types
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
