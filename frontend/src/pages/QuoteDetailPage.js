import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ActionIconButton from '../components/ActionIconButton';

import { Plus, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { useCompanyCurrency, formatMoney } from '../lib/currency';


const newLine = () => ({
  item_name: '',
  recipe_id: '',
  width_mm: '',
  height_mm: '',
  item_note: '',
  quantity: 1,

  internal_cost: 0,
  recipe_price_each: 0,
  recipe_total: 0,

  fulfilment_type: 'COLLECTION',
  install_type_id: '',
  fulfilment_price: 0,
  fulfilment_note: '',

  line_total: 0,
  needs_calculation: true,
});

const newAddon = () => ({
  description: '',
  selling_price: '',
});


function countWorkingDaysFromToday(dateString) {
  if (!dateString) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${dateString}T00:00:00`);
  due.setHours(0, 0, 0, 0);

  if (Number.isNaN(due.getTime())) return null;
  if (due < today) return -1;

  let count = 0;
  const cursor = new Date(today);

  while (cursor < due) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      count += 1;
    }
  }

  return count;
}

export default function QuoteDetailPage() {
  const currency = useCompanyCurrency();
  const money = (value) => formatMoney(value, currency);

  const { id } = useParams();
  const navigate = useNavigate();

  const [quote, setQuote] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [installTypes, setInstallTypes] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [clientData, setClientData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    description: '',
    due_date: '',
    discount_percent: '',
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      calculateAllLines(false);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, installTypes]);

  const loadData = async () => {
    try {
      const [quoteRes, recipesRes, installRes, clientsRes] = await Promise.all([
        api.get(`/quotes/${id}`),
        api.get('/recipes'),
        api.get('/install-types'),
        api.get('/clients'),
      ]);

      const q = quoteRes.data;
      setQuote(q);
      setRecipes(recipesRes.data || []);
      setInstallTypes(installRes.data || []);
      setClients(clientsRes.data || []);

      setClientData({
        client_name: q.client_name || '',
        client_email: q.client_email || '',
        client_phone: q.client_phone || '',
        client_address: q.client_address || '',
        description: q.description || '',
        due_date: q.due_date || '',
        discount_percent: q.blueprint?.discount_percent?.toString() || '',
      });

      setClientSearch(q.client_name || '');

      const savedLines = q.blueprint?.estimate_lines || [];
      const savedAddons = q.blueprint?.estimate_addons || [];

      setLines(savedLines.length > 0 ? savedLines : [newLine()]);
      setAddons(savedAddons);
    } catch {
      toast.error('Failed to load estimate data');
    } finally {
      setLoading(false);
    }
  };

  const selectClient = (client) => {
    setClientData({
      ...clientData,
      client_name: client.company_name || '',
      client_email: client.email || '',
      client_phone: client.phone || '',
      client_address: client.billing_address || client.site_address || '',
      description: clientData.description || client.notes || '',
      due_date: clientData.due_date || '',
    });
    setClientSearch(client.company_name || '');
  };

  const matchedClients = clients.filter((client) => {
    const term = clientSearch.toLowerCase();
    if (!term) return false;

    return (
      client.company_name?.toLowerCase().includes(term) ||
      client.contact_person?.toLowerCase().includes(term) ||
      client.email?.toLowerCase().includes(term) ||
      client.phone?.toLowerCase().includes(term)
    );
  }).slice(0, 5);

  const exactClientExists = clients.some(
    (client) => client.company_name?.trim().toLowerCase() === clientData.client_name.trim().toLowerCase()
  );

  const dueWorkingDays = countWorkingDaysFromToday(clientData.due_date);
  const dueWarning = dueWorkingDays !== null && dueWorkingDays < 15;

  const saveClientIfNew = async () => {
    if (!clientData.client_name.trim() || exactClientExists) return;

    await api.post('/clients', {
      company_name: clientData.client_name.trim(),
      contact_person: null,
      email: clientData.client_email || null,
      phone: clientData.client_phone || null,
      billing_address: clientData.client_address || null,
      site_address: null,
      vat_number: null,
      notes: clientData.description || null,
    });

    toast.success('New client saved to Clients');
    const res = await api.get('/clients');
    setClients(res.data || []);
  };

  const calculateInstallCostPerSqm = (install) => {
    if (!install) return 0;

    const people = Number(install.quantity_of_people) || 1;
    const labourRate = (Number(install.rate_per_hour) || 0) * people;

    const toolsRate = (install.tools || []).reduce((sum, tool) => {
      return sum + ((Number(tool.quantity) || 0) * (Number(tool.cost_per_hour) || 0));
    }, 0);

    const hireMachineRate = Number(install.hire_machine_rate_per_hour) || 0;
    const hourlyTotal = labourRate + toolsRate + hireMachineRate;
    const sqmPerHour = Number(install.sqm_per_hour) || 0;

    return sqmPerHour > 0 ? hourlyTotal / sqmPerHour : 0;
  };

  const recalculateLine = async (line) => {
    const width = Number(line.width_mm) || 0;
    const height = Number(line.height_mm) || 0;
    const qty = Number(line.quantity) || 1;
    const sqm = (width / 1000) * (height / 1000);

    const selectedRecipe = recipes.find((recipe) => recipe.id === line.recipe_id);
    const selectedRecipeName = selectedRecipe?.name || line.recipe_name || '';
    const itemName = line.item_name || line.product_name || selectedRecipeName;

    let internalCost = 0;
    let recipePriceEach = 0;
    let recipeTotal = 0;

    if (line.recipe_id && width > 0 && height > 0) {
      try {
        const res = await api.post('/estimation/calculate-sign', {
          recipe_id: line.recipe_id,
          width_mm: width,
          height_mm: height,
          labour_hours: 0,
          install_hours: 0,
          travel_km: 0,
          accommodation_days: 0,
          custom_items: [],
        });

        internalCost = Number(res.data.total_cost) || 0;
        recipePriceEach = Number(res.data.total_selling) || 0;
        recipeTotal = recipePriceEach * qty;
      } catch {
        toast.error('Recipe calculation failed');
      }
    }

    let fulfilmentPrice = 0;

    if (line.fulfilment_type === 'COLLECTION') {
      fulfilmentPrice = 0;
    }

    if (line.fulfilment_type === 'DELIVERY') {
      fulfilmentPrice = Number(line.fulfilment_price) || 0;
    }

    if (line.fulfilment_type === 'SITE_INSTALL') {
      const install = installTypes.find((item) => item.id === line.install_type_id);
      const installCostPerSqm = calculateInstallCostPerSqm(install);
      fulfilmentPrice = installCostPerSqm * sqm * qty;
    }

    return {
      ...line,
      item_name: itemName,
      item_note: line.item_note || '',
      recipe_name: selectedRecipeName,
      product_name: itemName,
      internal_cost: internalCost,
      recipe_price_each: recipePriceEach,
      recipe_total: recipeTotal,
      fulfilment_price: fulfilmentPrice,
      line_total: recipeTotal + fulfilmentPrice,
      needs_calculation: false,
    };
  };

  const updateLine = (index, field, value) => {
    const updated = [...lines];

    updated[index] = {
      ...updated[index],
      [field]: value,
      needs_calculation: true,
    };

    if (field === 'fulfilment_type') {
      updated[index].install_type_id = '';
      updated[index].fulfilment_price = 0;
      updated[index].fulfilment_note = '';
    }

    setLines(updated);
  };

  const calculateLine = async (index) => {
    const updated = [...lines];
    updated[index] = await recalculateLine(updated[index]);
    setLines(updated);
  };

  const shouldCalculateLine = (line) => {
    return Boolean(line.recipe_id && Number(line.width_mm) > 0 && Number(line.height_mm) > 0);
  };

  const calculateAllLines = async (showToast = true) => {
    const updated = [];

    for (const line of lines) {
      if (shouldCalculateLine(line)) {
        updated.push(await recalculateLine(line));
      } else {
        updated.push(line);
      }
    }

    setLines(updated);

    if (showToast) {
      toast.success('All complete line items calculated');
    }

    return updated;
  };

  const handleSaveAndClose = async () => {
    if (!clientData.due_date) {
      toast.error('Job Due Date is required before saving the estimate.');
      return;
    }

    try {
      const calculatedLines = await calculateAllLines(false);
      await saveClientIfNew();

      const linesSubtotal = calculatedLines.reduce(
        (sum, line) => sum + (Number(line.line_total) || 0),
        0
      );

      const addonsTotal = addons.reduce(
        (sum, addon) => sum + (Number(addon.selling_price) || 0),
        0
      );

      const subtotalBeforeDiscount = linesSubtotal + addonsTotal;
      const discountPercentForSave = Number(clientData.discount_percent) || 0;
      const discountValueForSave = subtotalBeforeDiscount * (discountPercentForSave / 100);
      const subtotalAfterDiscountForSave = subtotalBeforeDiscount - discountValueForSave;
      const vatForSave = subtotalAfterDiscountForSave * 0.15;
      const totalAmountForSave = subtotalAfterDiscountForSave + vatForSave;

      await api.put(`/quotes/${id}/estimate-draft`, {
        client_name: clientData.client_name,
        client_email: clientData.client_email,
        client_phone: clientData.client_phone,
        client_address: clientData.client_address,
        description: clientData.description,
        due_date: clientData.due_date || '',
        lines: calculatedLines,
        addons: addons || [],
        discount_percent: discountPercentForSave,
        subtotal: subtotalBeforeDiscount,
        discount_value: discountValueForSave,
        subtotal_after_discount: subtotalAfterDiscountForSave,
        vat: vatForSave,
        total_amount: totalAmountForSave,
      });

      toast.success('Estimate calculated and saved');
      navigate(quote?.quote_number ? '/quotes' : '/estimations');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save estimate');
    }
  };

  const addLine = () => {
    setLines((prev) => [...prev, newLine()]);
  };

  const removeLine = (index) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const addAddon = () => {
    setAddons((prev) => [...prev, newAddon()]);
  };

  const updateAddon = (index, field, value) => {
    setAddons((prev) =>
      prev.map((addon, i) =>
        i === index ? { ...addon, [field]: value } : addon
      )
    );
  };

  const removeAddon = (index) => {
    setAddons((prev) => prev.filter((_, i) => i !== index));
  };

  const getFulfilmentPriceLabel = (type) => {
    if (type === 'SITE_INSTALL') return 'Installation Price';
    if (type === 'DELIVERY') return 'Delivery Price';
    return 'Collection Price';
  };

  const subtotal = lines.reduce((sum, line) => sum + (Number(line.line_total) || 0), 0);
  const addonTotal = addons.reduce((sum, addon) => sum + (Number(addon.selling_price) || 0), 0);
  const estimateSubtotal = subtotal + addonTotal;
  const discountPercent = Number(clientData.discount_percent) || 0;
  const discountValue = estimateSubtotal * (discountPercent / 100);
  const discountedSubtotal = estimateSubtotal - discountValue;
  const vat = discountedSubtotal * 0.15;
  const total = discountedSubtotal + vat;

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center p-12">
          <div className="animate-spin h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl pb-24 touch-pan-y">
        <div>
          <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black tracking-tight leading-none">Estimate Builder</h1>
        <div className="text-2xl font-bold text-blue-700">
          {quote?.quote_number || quote?.estimate_number || '-'}
        </div>
      </div>
          <p className="text-slate-600 mt-2">
            Internal estimate view. Costs are visible here. Client quote will show selling prices only.
            Enter the line details, then click Calc to price that line.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 space-y-4">
          <h2 className="text-xl font-bold">Client / Company Details</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Search / Select Client</Label>
              <Input
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setClientData({ ...clientData, client_name: e.target.value });
                }}
                placeholder="Search existing client or type new client"
              />

              {matchedClients.length > 0 && (
                <div className="rounded-md border bg-white shadow-sm">
                  {matchedClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => selectClient(client)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <div className="font-semibold">{client.company_name}</div>
                      <div className="text-xs text-slate-500">
                        {client.email || client.phone || client.contact_person}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {clientData.client_name && !exactClientExists && (
                <div className="flex items-center justify-between gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <span>New client. Save it to Clients for future use.</span>
                  <Button type="button" size="sm" variant="outline" onClick={saveClientIfNew}>
                    Save Client
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={clientData.client_email}
                onChange={(e) => setClientData({ ...clientData, client_email: e.target.value })}
                placeholder="client@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={clientData.client_phone}
                onChange={(e) => setClientData({ ...clientData, client_phone: e.target.value })}
                placeholder="+27..."
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={clientData.client_address}
                onChange={(e) => setClientData({ ...clientData, client_address: e.target.value })}
                placeholder="Client address"
              />
            </div>

              <div className="space-y-2">
                <Label>Job Due Date</Label>
                <Input
                  type="date"
                  value={clientData.due_date || ''}
                  onChange={(e) => setClientData({ ...clientData, due_date: e.target.value })}
                  required
                  data-testid="estimate-due-date-input"
                />
                <p className="text-xs text-slate-500">
                  This date follows the estimate through quote, invoice and production.
                </p>
              </div>

              {dueWarning && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800 md:col-span-2">
                  Warning: this due date is {dueWorkingDays < 0 ? 'already overdue' : `${dueWorkingDays} working day${dueWorkingDays === 1 ? '' : 's'} away`}. It is less than the 15 working day planning window.
                </div>
              )}

            <div className="space-y-2 md:col-span-2">
              <Label>Project Description</Label>
              <Textarea
                value={clientData.description}
                onChange={(e) => setClientData({ ...clientData, description: e.target.value })}
                placeholder="Brief project description"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Discount %</Label>
              <Input
                type="number"
                step="0.01"
                value={clientData.discount_percent}
                onChange={(e) => setClientData({ ...clientData, discount_percent: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <Table className="w-full min-w-[1200px] text-sm">
            <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <TableRow>
                <TableHead className="px-4 py-3">Item Name</TableHead>
                <TableHead className="px-4 py-3">Recipe</TableHead>
                <TableHead className="px-4 py-3">Width</TableHead>
                <TableHead className="px-4 py-3">Height</TableHead>
                <TableHead className="px-4 py-3">Note</TableHead>
                <TableHead className="px-4 py-3">Qty</TableHead>
                <TableHead className="px-4 py-3">Internal Cost</TableHead>
                <TableHead className="px-4 py-3">Selling Each</TableHead>
                <TableHead className="px-4 py-3">Line Total</TableHead>
                <TableHead className="px-4 py-3">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y">
              {lines.map((line, index) => (
                <React.Fragment key={index}>
                  <TableRow>
                    <TableCell className="px-4 py-3">
                      <Input
                        value={line.item_name || ''}
                        onChange={(e) => updateLine(index, 'item_name', e.target.value)}
                        placeholder="e.g., Vinyl sticker"
                      />
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <select
                        value={line.recipe_id}
                        onChange={(e) => updateLine(index, 'recipe_id', e.target.value)}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="">Select Recipe</option>
                        {recipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.name}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Input
                        type="number"
                        value={line.width_mm}
                        onChange={(e) => updateLine(index, 'width_mm', e.target.value)}
                        placeholder="mm"
                      />
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Input
                        type="number"
                        value={line.height_mm}
                        onChange={(e) => updateLine(index, 'height_mm', e.target.value)}
                        placeholder="mm"
                      />
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Input
                        value={line.item_note || ''}
                        onChange={(e) => updateLine(index, 'item_note', e.target.value)}
                        placeholder="Line note"
                      />
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                      />
                    </TableCell>

                    <TableCell className="px-4 py-3 font-mono text-red-700">
                      {money(line.internal_cost)}
                    </TableCell>

                    <TableCell className="px-4 py-3 font-mono">
                      {money(line.recipe_price_each)}
                    </TableCell>

                    <TableCell className="px-4 py-3 font-mono font-bold text-blue-700">
                      {money(line.line_total)}
                    </TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="space-y-2">
                        {line.needs_calculation && (
                          <div className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                            This line has not been calculated since the last change.
                          </div>
                        )}

                        <div className="flex gap-3 items-start">
                          <ActionIconButton
                            icon={<Calculator size={16} />}
                            label="Calc"
                            tone="pdf"
                            onClick={() => calculateLine(index)}
                            title="Calculate line"
                          />

                          <ActionIconButton
                            icon={<Trash2 size={16} />}
                            label="Remove"
                            tone="delete"
                            onClick={() => removeLine(index)}
                            disabled={lines.length === 1}
                            title="Remove line"
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={10} className="px-4 py-4 bg-slate-50">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label>Delivery / Install / Collection</Label>
                          <select
                            value={line.fulfilment_type}
                            onChange={(e) => updateLine(index, 'fulfilment_type', e.target.value)}
                            className="w-full rounded border px-3 py-2"
                          >
                            <option value="COLLECTION">Collection - R0.00</option>
                            <option value="DELIVERY">Delivery</option>
                            <option value="SITE_INSTALL">Site Install</option>
                          </select>
                        </div>

                        {line.fulfilment_type === 'SITE_INSTALL' && (
                          <div className="space-y-2">
                            <Label>Install Type</Label>
                            <select
                              value={line.install_type_id}
                              onChange={(e) => updateLine(index, 'install_type_id', e.target.value)}
                              className="w-full rounded border px-3 py-2"
                            >
                              <option value="">Select install type</option>
                              {installTypes.map((install) => (
                                <option key={install.id} value={install.id}>
                                  {install.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {line.fulfilment_type === 'DELIVERY' && (
                          <div className="space-y-2">
                            <Label>Delivery Price</Label>
                            <Input
                              type="number"
                              value={line.fulfilment_price}
                              onChange={(e) => updateLine(index, 'fulfilment_price', e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        )}

                        <div className="space-y-2 md:col-span-2">
                          <Label>Note</Label>
                          <Input
                            value={line.fulfilment_note}
                            onChange={(e) => updateLine(index, 'fulfilment_note', e.target.value)}
                            placeholder="Delivery / install / collection note"
                          />
                        </div>
                      </div>

                      <div className="mt-3 text-right text-sm">
                        {getFulfilmentPriceLabel(line.fulfilment_type)}: <strong>{money(line.fulfilment_price)}</strong>
                      </div>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          <div className="p-4">
            <Button type="button" onClick={addLine} className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]">
              <Plus size={16} className="mr-2" />
              Add Line Item
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Other Add-ons</h2>
            <Button type="button" variant="outline" onClick={addAddon}>
              <Plus size={16} className="mr-2" />
              Add Add-on
            </Button>
          </div>

          {addons.length === 0 ? (
            <div className="text-sm text-slate-500">No add-ons added.</div>
          ) : (
            <div className="space-y-3">
              {addons.map((addon, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_auto]">
                  <Input
                    value={addon.description}
                    onChange={(e) => updateAddon(index, 'description', e.target.value)}
                    placeholder="Description"
                  />
                  <Input
                    type="number"
                    value={addon.selling_price}
                    onChange={(e) => updateAddon(index, 'selling_price', e.target.value)}
                    placeholder="Selling price"
                  />
                  <ActionIconButton
                    icon={<Trash2 size={16} />}
                    label="Remove"
                    tone="delete"
                    onClick={() => removeAddon(index)}
                    title="Remove add-on"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-slate-50 p-5">
          <div className="ml-auto max-w-sm space-y-2 text-right">
            <div>Subtotal: <strong>{money(estimateSubtotal)}</strong></div>
            <div>Discount ({discountPercent.toFixed(2)}%): <strong>- {money(discountValue)}</strong></div>
            <div>Subtotal after Discount: <strong>{money(discountedSubtotal)}</strong></div>
            <div>VAT (15%): <strong>{money(vat)}</strong></div>
            <div className="text-xl font-black">Total: {money(total)}</div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pb-8">
          <Button
            type="button"
            onClick={handleSaveAndClose}
            className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
          >
            Save and Close Estimate
          </Button>
          <p className="text-xs text-slate-500">
            This will recalculate all complete line items before closing.
          </p>
        </div>
      </div>
    </Layout>
  );
}
