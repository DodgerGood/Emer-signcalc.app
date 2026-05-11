import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ActionIconButton from '../components/ActionIconButton';
import { Plus, Pencil, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';

const money = (value) => `R ${(Number(value) || 0).toFixed(2)}`;

const emptyForm = () => ({
  name: '',
  quantity_of_people: '2',
  rate_per_hour: '',
  sqm_per_hour: '',
  tools: [],
  hire_machine_name: '',
  hire_machine_supplier: '',
  hire_machine_rate_per_hour: '',
});

export default function InstallTypesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState(emptyForm());

  const importFileRef = useRef(null);
  const itemsPerPage = 10;

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const response = await api.get('/install-types');
      setItems(response.data || []);
    } catch {
      toast.error('Failed to load installation types');
    } finally {
      setLoading(false);
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

    return {
      labourRate,
      toolsRate,
      hireMachineRate,
      hourlyTotal,
      costPerSqm,
    };
  };

  const formTotals = calculateItemCost({
    quantity_of_people: formData.quantity_of_people,
    rate_per_hour: formData.rate_per_hour,
    sqm_per_hour: formData.sqm_per_hour,
    tools: formData.tools,
    hire_machine_rate_per_hour: formData.hire_machine_rate_per_hour,
  });

  const filteredItems = items.filter((item) => {
    const term = searchTerm.toLowerCase();

    return (
      item.name?.toLowerCase().includes(term) ||
      item.hire_machine_name?.toLowerCase().includes(term) ||
      item.hire_machine_supplier?.toLowerCase().includes(term)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const resetForm = () => {
    setEditingId(null);
    setFormData(emptyForm());
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const addTool = () => {
    setFormData((prev) => ({
      ...prev,
      tools: [...(prev.tools || []), { name: '', quantity: 1, cost_per_hour: 0 }],
    }));
  };

  const updateTool = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...(prev.tools || [])];

      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      return {
        ...prev,
        tools: updated,
      };
    });
  };

  const removeTool = (index) => {
    setFormData((prev) => {
      const updated = [...(prev.tools || [])];
      updated.splice(index, 1);

      return {
        ...prev,
        tools: updated,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        name: formData.name,
        quantity_of_people: parseInt(formData.quantity_of_people, 10) || 1,
        rate_per_hour: parseFloat(formData.rate_per_hour) || 0,
        sqm_per_hour: formData.sqm_per_hour ? parseFloat(formData.sqm_per_hour) : null,
        tools: (formData.tools || []).map((tool) => ({
          name: tool.name || '',
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
        await api.put(`/install-types/${editingId}`, payload);
        toast.success('Installation type updated');
      } else {
        await api.post('/install-types', payload);
        toast.success('Installation type created');
      }

      setDialogOpen(false);
      resetForm();
      loadItems();
    } catch (error) {
      toast.error(
        typeof error.response?.data?.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response?.data?.detail || 'Operation failed')
      );
    }
  };

  const handleEdit = (item) => {
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

  const handleDelete = async (id) => {
    if (!window.confirm('Deleting this installation type may affect existing quotes. Click OK to delete.')) return;

    try {
      await api.delete(`/install-types/${id}`);
      toast.success('Installation type deleted');
      loadItems();
    } catch (err) {
      const data = err?.response?.data?.detail;

      if (data?.recipes) {
        alert(`This item cannot be deleted because it is used in:\n\n${data.recipes.join('\n')}`);
      } else {
        toast.error('Delete failed');
      }
    }
  };

  const handleShowUsage = async (id) => {
    try {
      const response = await api.get(`/item-usage/${id}`);
      const recipes = response.data.used_in || [];

      if (recipes.length === 0) {
        alert('This item is not currently used in any recipes.');
        return;
      }

      alert(`This item is used in:\n\n${recipes.join('\n')}`);
    } catch {
      toast.error('Failed to check usage');
    }
  };

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

      toast.success(`Import complete: ${result.imported_count} added, ${result.updated_count} updated`);

      if (result.error_count > 0) {
        toast.error(`${result.error_count} row(s) had errors`);
        console.log('Installation import errors:', result.errors);
      }

      loadItems();
    } catch (error) {
      toast.error(
        typeof error.response?.data?.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response?.data?.detail || error.message || 'Import failed')
      );
    } finally {
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Installation Pricelist</h1>
            <p className="text-slate-600 mt-2">
              Manage installation rates, tools, and hire equipment.
            </p>
          </div>

          <div className="flex items-center gap-2">
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
              Import CSV
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportInstallTypes}
              data-testid="export-install-types-btn"
            >
              Export CSV
            </Button>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  onClick={handleOpenCreate}
                  data-testid="add-install-btn"
                  className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                >
                  <Plus size={18} className="mr-2" />
                  Add Install Type
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Edit Installation Type' : 'Add New Installation Type'}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
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
                        How many square meters the full installation team can complete per hour.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Tools</Label>

                    {(formData.tools || []).map((tool, index) => (
                      <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-start">
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
                          variant="ghost"
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

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm space-y-1">
                    <div>Installation labour/hour: {money(formTotals.labourRate)}</div>
                    <div>Tools/hour: {money(formTotals.toolsRate)}</div>
                    <div>Hire machine/hour: {money(formTotals.hireMachineRate)}</div>
                    <div className="font-semibold text-green-700">
                      Total installation/hour: {money(formTotals.hourlyTotal)}
                    </div>

                    {formTotals.costPerSqm !== null && (
                      <div className="font-semibold text-blue-700">
                        Cost per m²: {money(formTotals.costPerSqm)}
                      </div>
                    )}

                    <div className="text-xs text-slate-500 pt-2">
                      Travel is handled at quote stage and is not included in installation rates.
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      data-testid="install-submit-btn"
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
          Use the exported CSV as your template. Matching names update existing installation types, new names are added.
        </p>

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

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <Table className="w-full min-w-[900px] text-sm">
                <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <TableRow>
                    <TableHead className="px-4 py-3">Name</TableHead>
                    <TableHead className="px-4 py-3">Cost / m²</TableHead>
                    <TableHead className="px-4 py-3">m² / hr</TableHead>
                    <TableHead className="px-4 py-3">Hire Machine</TableHead>
                    <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="divide-y">
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12">
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
                      const totals = calculateItemCost(item);

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="px-4 py-3 font-semibold">{item.name}</TableCell>
                          <TableCell className="px-4 py-3">
                            {totals.costPerSqm !== null ? money(totals.costPerSqm) : '-'}
                          </TableCell>
                          <TableCell className="px-4 py-3">{item.sqm_per_hour || '-'}</TableCell>
                          <TableCell className="px-4 py-3">{item.hire_machine_name || '-'}</TableCell>
                          <TableCell className="px-4 py-3 align-top">
                            <div className="flex justify-end gap-3 items-start">
                              <ActionIconButton
                                icon={<Info size={16} />}
                                label="Usage"
                                tone="info"
                                onClick={() => handleShowUsage(item.id)}
                                title="Show recipe usage"
                              />

                              <ActionIconButton
                                icon={<Pencil size={16} />}
                                label="Edit"
                                tone="edit"
                                onClick={() => handleEdit(item)}
                              />

                              <ActionIconButton
                                icon={<Trash2 size={16} />}
                                label="Delete"
                                tone="delete"
                                onClick={() => handleDelete(item.id)}
                              />
                            </div>
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
      </div>
    </Layout>
  );
}
