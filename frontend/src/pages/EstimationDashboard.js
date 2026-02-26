import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, Trash2, Calculator, FileText, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function EstimationDashboard() {
  const { id: quoteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [quote, setQuote] = useState(null);
  const [blueprint, setBlueprint] = useState({ signs: [], total_cost: 0, total_selling: 0, total_profit: 0, profit_margin_percent: 0 });
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  
  // Dropdown data
  const [recipes, setRecipes] = useState([]);
  const [labourTypes, setLabourTypes] = useState([]);
  const [installTypes, setInstallTypes] = useState([]);
  
  // Sign form
  const [signForm, setSignForm] = useState({
    sign_name: '',
    width_mm: '',
    height_mm: '',
    recipe_id: '',
    labour_type_id: '',
    labour_hours: '',
    install_type_id: '',
    install_hours: '',
    travel_km: '',
    accommodation_days: '',
    custom_items: []
  });
  
  // Preview
  const [signPreview, setSignPreview] = useState(null);
  const [showCosts, setShowCosts] = useState(true);
  
  // Custom item form
  const [customItem, setCustomItem] = useState({
    description: '',
    quantity: '1',
    cost: '',
    markup_percent: '30',
    selling_price: ''
  });

  const canEdit = user?.role === 'QUOTING_STAFF' && (!quote || quote.created_by === user?.id);

  useEffect(() => {
    loadData();
  }, [quoteId]);

  const loadData = async () => {
    try {
      const [recipesRes, labourRes, installRes] = await Promise.all([
        api.get('/recipes'),
        api.get('/labour-types'),
        api.get('/install-types')
      ]);
      
      setRecipes(recipesRes.data);
      setLabourTypes(labourRes.data);
      setInstallTypes(installRes.data);
      
      if (quoteId) {
        const blueprintRes = await api.get(`/quotes/${quoteId}/blueprint`);
        setQuote(blueprintRes.data);
        setBlueprint(blueprintRes.data.blueprint);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculatePreview = async () => {
    if (!signForm.width_mm || !signForm.height_mm || !signForm.recipe_id) {
      toast.error('Please fill in width, height, and sign type');
      return;
    }
    
    setCalculating(true);
    try {
      const response = await api.post('/estimation/calculate-sign', {
        sign_name: signForm.sign_name,
        width_mm: parseFloat(signForm.width_mm),
        height_mm: parseFloat(signForm.height_mm),
        recipe_id: signForm.recipe_id,
        labour_type_id: signForm.labour_type_id || null,
        labour_hours: parseFloat(signForm.labour_hours) || 0,
        install_type_id: signForm.install_type_id || null,
        install_hours: parseFloat(signForm.install_hours) || 0,
        travel_km: parseFloat(signForm.travel_km) || 0,
        accommodation_days: parseFloat(signForm.accommodation_days) || 0,
        custom_items: signForm.custom_items
      });
      
      setSignPreview(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to calculate');
    } finally {
      setCalculating(false);
    }
  };

  const addSignToQuote = async () => {
    if (!signPreview) {
      toast.error('Please calculate the sign first');
      return;
    }
    
    try {
      const response = await api.post(`/quotes/${quoteId}/signs`, {
        sign_name: signForm.sign_name,
        width_mm: parseFloat(signForm.width_mm),
        height_mm: parseFloat(signForm.height_mm),
        recipe_id: signForm.recipe_id,
        labour_type_id: signForm.labour_type_id || null,
        labour_hours: parseFloat(signForm.labour_hours) || 0,
        install_type_id: signForm.install_type_id || null,
        install_hours: parseFloat(signForm.install_hours) || 0,
        travel_km: parseFloat(signForm.travel_km) || 0,
        accommodation_days: parseFloat(signForm.accommodation_days) || 0,
        custom_items: signForm.custom_items
      });
      
      toast.success('Sign added to quote');
      setBlueprint(prev => ({
        ...prev,
        signs: [...prev.signs, response.data.sign],
        ...response.data.blueprint_totals
      }));
      
      // Reset form
      resetSignForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add sign');
    }
  };

  const removeSign = async (signId) => {
    if (!window.confirm('Remove this sign from the quote?')) return;
    
    try {
      const response = await api.delete(`/quotes/${quoteId}/signs/${signId}`);
      setBlueprint(response.data.blueprint_totals);
      toast.success('Sign removed');
      loadData();
    } catch (error) {
      toast.error('Failed to remove sign');
    }
  };

  const resetSignForm = () => {
    setSignForm({
      sign_name: '',
      width_mm: '',
      height_mm: '',
      recipe_id: '',
      labour_type_id: '',
      labour_hours: '',
      install_type_id: '',
      install_hours: '',
      travel_km: '',
      accommodation_days: '',
      custom_items: []
    });
    setSignPreview(null);
  };

  const addCustomItem = () => {
    if (!customItem.description || !customItem.selling_price) {
      toast.error('Please fill in description and selling price');
      return;
    }
    
    setSignForm(prev => ({
      ...prev,
      custom_items: [...prev.custom_items, {
        description: customItem.description,
        quantity: parseFloat(customItem.quantity) || 1,
        cost: parseFloat(customItem.cost) || 0,
        markup_percent: parseFloat(customItem.markup_percent) || 0,
        selling_price: parseFloat(customItem.selling_price) || 0
      }]
    }));
    
    setCustomItem({
      description: '',
      quantity: '1',
      cost: '',
      markup_percent: '30',
      selling_price: ''
    });
  };

  const removeCustomItem = (index) => {
    setSignForm(prev => ({
      ...prev,
      custom_items: prev.custom_items.filter((_, i) => i !== index)
    }));
  };

  const completeQuote = async () => {
    if (blueprint.signs.length === 0) {
      toast.error('Please add at least one sign to the quote');
      return;
    }
    
    try {
      await api.post(`/quotes/${quoteId}/complete`);
      toast.success('Quote completed! Ready for approval.');
      navigate('/quotes');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete quote');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 fade-in">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Estimation Dashboard</h1>
            <p className="text-slate-600 mt-2">
              {quote ? `Quote for ${quote.client_name}` : 'Create estimates for each sign'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCosts(!showCosts)}
              data-testid="toggle-costs-btn"
            >
              {showCosts ? <EyeOff size={18} className="mr-2" /> : <Eye size={18} className="mr-2" />}
              {showCosts ? 'Hide Costs' : 'Show Costs'}
            </Button>
            {canEdit && blueprint.signs.length > 0 && (
              <Button
                onClick={completeQuote}
                className="bg-green-600 hover:bg-green-700"
                data-testid="complete-quote-btn"
              >
                <Check size={18} className="mr-2" />
                Complete Quote
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sign Configuration Form */}
          {canEdit && (
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configure Sign</CardTitle>
                  <CardDescription>Enter sign dimensions and select options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Sign Name (optional)</Label>
                      <Input
                        value={signForm.sign_name}
                        onChange={(e) => setSignForm({ ...signForm, sign_name: e.target.value })}
                        placeholder="e.g., Front Fascia"
                        data-testid="sign-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Width (mm) *</Label>
                      <Input
                        type="number"
                        value={signForm.width_mm}
                        onChange={(e) => setSignForm({ ...signForm, width_mm: e.target.value })}
                        placeholder="e.g., 3000"
                        data-testid="sign-width-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Height (mm) *</Label>
                      <Input
                        type="number"
                        value={signForm.height_mm}
                        onChange={(e) => setSignForm({ ...signForm, height_mm: e.target.value })}
                        placeholder="e.g., 1200"
                        data-testid="sign-height-input"
                      />
                    </div>
                  </div>

                  {/* Sign Type (Recipe) */}
                  <div className="space-y-2">
                    <Label>Sign Type (Recipe) *</Label>
                    <Select
                      value={signForm.recipe_id}
                      onValueChange={(v) => setSignForm({ ...signForm, recipe_id: v })}
                    >
                      <SelectTrigger data-testid="sign-type-select">
                        <SelectValue placeholder="Select sign type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {recipes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Labour */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Labour Type</Label>
                      <Select
                        value={signForm.labour_type_id}
                        onValueChange={(v) => setSignForm({ ...signForm, labour_type_id: v })}
                      >
                        <SelectTrigger data-testid="labour-type-select">
                          <SelectValue placeholder="Select labour..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {labourTypes.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.name} (R{l.rate_per_hour}/hr)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Labour Hours</Label>
                      <Input
                        type="number"
                        value={signForm.labour_hours}
                        onChange={(e) => setSignForm({ ...signForm, labour_hours: e.target.value })}
                        placeholder="e.g., 4"
                        data-testid="labour-hours-input"
                      />
                    </div>
                  </div>

                  {/* Installation/Machinery */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Installation/Machinery</Label>
                      <Select
                        value={signForm.install_type_id}
                        onValueChange={(v) => setSignForm({ ...signForm, install_type_id: v })}
                      >
                        <SelectTrigger data-testid="install-type-select">
                          <SelectValue placeholder="Select installation..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {installTypes.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Installation Hours</Label>
                      <Input
                        type="number"
                        value={signForm.install_hours}
                        onChange={(e) => setSignForm({ ...signForm, install_hours: e.target.value })}
                        placeholder="e.g., 2"
                        data-testid="install-hours-input"
                      />
                    </div>
                  </div>

                  {/* Travel & Accommodation */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Travel (km)</Label>
                      <Input
                        type="number"
                        value={signForm.travel_km}
                        onChange={(e) => setSignForm({ ...signForm, travel_km: e.target.value })}
                        placeholder="e.g., 50"
                        data-testid="travel-km-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Accommodation (days)</Label>
                      <Input
                        type="number"
                        value={signForm.accommodation_days}
                        onChange={(e) => setSignForm({ ...signForm, accommodation_days: e.target.value })}
                        placeholder="e.g., 2"
                        data-testid="accommodation-days-input"
                      />
                    </div>
                  </div>

                  {/* Custom Items Section */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-semibold mb-3">Custom Items (Internal costs hidden from client)</h4>
                    
                    {signForm.custom_items.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {signForm.custom_items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                            <span className="text-sm">{item.description} × {item.quantity}</span>
                            <div className="flex items-center gap-4">
                              {showCosts && <span className="text-sm text-slate-500">Cost: R{item.cost}</span>}
                              <span className="text-sm font-medium">Sell: R{item.selling_price}</span>
                              <Button variant="ghost" size="sm" onClick={() => removeCustomItem(idx)}>
                                <Trash2 size={14} className="text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-5 gap-2">
                      <Input
                        placeholder="Description"
                        value={customItem.description}
                        onChange={(e) => setCustomItem({ ...customItem, description: e.target.value })}
                        data-testid="custom-description-input"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={customItem.quantity}
                        onChange={(e) => setCustomItem({ ...customItem, quantity: e.target.value })}
                        data-testid="custom-qty-input"
                      />
                      <Input
                        type="number"
                        placeholder="Cost (R)"
                        value={customItem.cost}
                        onChange={(e) => setCustomItem({ ...customItem, cost: e.target.value })}
                        data-testid="custom-cost-input"
                      />
                      <Input
                        type="number"
                        placeholder="Markup %"
                        value={customItem.markup_percent}
                        onChange={(e) => setCustomItem({ ...customItem, markup_percent: e.target.value })}
                        data-testid="custom-markup-input"
                      />
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="Sell (R)"
                          value={customItem.selling_price}
                          onChange={(e) => setCustomItem({ ...customItem, selling_price: e.target.value })}
                          data-testid="custom-selling-input"
                        />
                        <Button onClick={addCustomItem} size="icon" variant="outline">
                          <Plus size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={calculatePreview}
                      disabled={calculating}
                      variant="outline"
                      data-testid="calculate-btn"
                    >
                      <Calculator size={18} className="mr-2" />
                      {calculating ? 'Calculating...' : 'Calculate Preview'}
                    </Button>
                    <Button
                      onClick={addSignToQuote}
                      disabled={!signPreview}
                      className="bg-[#2563EB] hover:bg-[#1e40af]"
                      data-testid="add-to-quote-btn"
                    >
                      <Plus size={18} className="mr-2" />
                      Add to Quote
                    </Button>
                    <Button variant="ghost" onClick={resetSignForm}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Sign Preview */}
              {signPreview && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-900">Sign Preview</CardTitle>
                    <CardDescription>
                      {signPreview.sign_name} - {signPreview.calculated_sqm} m²
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          {showCosts && <TableHead className="text-right">Cost (R)</TableHead>}
                          <TableHead className="text-right">Selling (R)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">{signPreview.recipe_name}</TableCell>
                          {showCosts && <TableCell className="text-right data-mono">{signPreview.recipe_cost.toFixed(2)}</TableCell>}
                          <TableCell className="text-right data-mono">{signPreview.recipe_selling.toFixed(2)}</TableCell>
                        </TableRow>
                        {signPreview.labour_cost > 0 && (
                          <TableRow>
                            <TableCell>Labour: {signPreview.labour_type_name} ({signPreview.labour_hours}h)</TableCell>
                            {showCosts && <TableCell className="text-right data-mono">{signPreview.labour_cost.toFixed(2)}</TableCell>}
                            <TableCell className="text-right data-mono">{signPreview.labour_selling.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {signPreview.install_cost > 0 && (
                          <TableRow>
                            <TableCell>Installation: {signPreview.install_type_name} ({signPreview.install_hours}h)</TableCell>
                            {showCosts && <TableCell className="text-right data-mono">{signPreview.install_cost.toFixed(2)}</TableCell>}
                            <TableCell className="text-right data-mono">{signPreview.install_selling.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {signPreview.travel_cost > 0 && (
                          <TableRow>
                            <TableCell>Travel ({signPreview.travel_km} km)</TableCell>
                            {showCosts && <TableCell className="text-right data-mono">{signPreview.travel_cost.toFixed(2)}</TableCell>}
                            <TableCell className="text-right data-mono">{signPreview.travel_selling.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {signPreview.accommodation_cost > 0 && (
                          <TableRow>
                            <TableCell>Accommodation ({signPreview.accommodation_days} days)</TableCell>
                            {showCosts && <TableCell className="text-right data-mono">{signPreview.accommodation_cost.toFixed(2)}</TableCell>}
                            <TableCell className="text-right data-mono">{signPreview.accommodation_selling.toFixed(2)}</TableCell>
                          </TableRow>
                        )}
                        {signPreview.custom_items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.description} × {item.quantity}</TableCell>
                            {showCosts && <TableCell className="text-right data-mono">{(item.cost * item.quantity).toFixed(2)}</TableCell>}
                            <TableCell className="text-right data-mono">{(item.selling_price * item.quantity).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold bg-slate-100">
                          <TableCell>TOTAL</TableCell>
                          {showCosts && <TableCell className="text-right data-mono">R {signPreview.total_cost.toFixed(2)}</TableCell>}
                          <TableCell className="text-right data-mono">R {signPreview.total_selling.toFixed(2)}</TableCell>
                        </TableRow>
                        {showCosts && (
                          <TableRow className="text-green-700">
                            <TableCell colSpan={2}>Profit Margin</TableCell>
                            <TableCell className="text-right data-mono">{signPreview.profit_margin}%</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Quote Blueprint Summary */}
          <div className={canEdit ? "lg:col-span-1" : "lg:col-span-3"}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText size={20} />
                  Quote Blueprint
                </CardTitle>
                <CardDescription>
                  {blueprint.signs.length} sign{blueprint.signs.length !== 1 ? 's' : ''} in quote
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {blueprint.signs.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No signs added yet</p>
                ) : (
                  <>
                    {blueprint.signs.map((sign, idx) => (
                      <div key={sign.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{sign.sign_name || `Sign ${idx + 1}`}</h4>
                            <p className="text-sm text-slate-500">
                              {sign.width_mm} × {sign.height_mm}mm ({sign.calculated_sqm} m²)
                            </p>
                            <p className="text-sm text-slate-500">{sign.recipe_name}</p>
                          </div>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSign(sign.id)}
                              className="text-red-600"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                        <div className="flex justify-between text-sm">
                          {showCosts && <span className="text-slate-500">Cost: R{sign.total_cost.toFixed(2)}</span>}
                          <span className="font-medium">Selling: R{sign.total_selling.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                      {showCosts && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Total Cost:</span>
                            <span className="font-mono">R {blueprint.total_cost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-green-700">
                            <span>Total Profit:</span>
                            <span className="font-mono">R {blueprint.total_profit.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-green-700">
                            <span>Margin:</span>
                            <span className="font-mono">{blueprint.profit_margin_percent}%</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Quote Total:</span>
                        <span className="font-mono">R {blueprint.total_selling.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Client Details (View Only for non-editors) */}
            {quote && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Client Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><strong>Name:</strong> {quote.client_name}</p>
                  {quote.client_email && <p><strong>Email:</strong> {quote.client_email}</p>}
                  {quote.client_phone && <p><strong>Phone:</strong> {quote.client_phone}</p>}
                  {quote.client_address && <p><strong>Address:</strong> {quote.client_address}</p>}
                  {quote.description && <p><strong>Notes:</strong> {quote.description}</p>}
                  <p className="text-slate-500 mt-4">
                    Created by: {quote.created_by_name}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
