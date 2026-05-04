import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useParams } from 'react-router-dom';
import api from '../lib/api';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function QuoteDetailPage() {
  const { id } = useParams();

  const [recipes, setRecipes] = useState([]);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const res = await api.get('/recipes');
      setRecipes(res.data);
    } catch {
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        recipe_id: '',
        width_mm: '',
        height_mm: '',
        quantity: 1,
        price: 0,
        total: 0,
      }
    ]);
  };

  const removeLine = (index) => {
    const updated = [...lines];
    updated.splice(index, 1);
    setLines(updated);
  };

  const updateLine = async (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    setLines(updated);

    const line = updated[index];

    if (line.recipe_id && line.width_mm && line.height_mm) {
      try {
        const res = await api.post('/estimation/calculate-sign', {
          recipe_id: line.recipe_id,
          width_mm: parseFloat(line.width_mm),
          height_mm: parseFloat(line.height_mm),
          labour_hours: 0,
          install_hours: 0,
          travel_km: 0,
          accommodation_days: 0,
          custom_items: []
        });

        const selling = res.data.total_selling;

        updated[index].price = selling;
        updated[index].total = selling * (line.quantity || 1);

        setLines([...updated]);

      } catch {
        toast.error('Calculation failed');
      }
    }
  };

  const subtotal = lines.reduce((sum, l) => sum + (l.total || 0), 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl">

        <h1 className="text-3xl font-black">Estimate Builder</h1>

        <div className="bg-white border rounded-md">

          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Recipe</TableHead>
                <TableHead>Width (mm)</TableHead>
                <TableHead>Height (mm)</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {lines.map((line, i) => (
                <TableRow key={i}>

                  <TableCell>
                    <select
                      className="border rounded px-2 py-1"
                      value={line.recipe_id}
                      onChange={(e) => updateLine(i, 'recipe_id', e.target.value)}
                    >
                      <option value="">Select</option>
                      {recipes.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </TableCell>

                  <TableCell>
                    <Input
                      value={line.width_mm}
                      onChange={(e) => updateLine(i, 'width_mm', e.target.value)}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      value={line.height_mm}
                      onChange={(e) => updateLine(i, 'height_mm', e.target.value)}
                    />
                  </TableCell>

                  <TableCell>
                    <Input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, 'quantity', parseInt(e.target.value))}
                    />
                  </TableCell>

                  <TableCell className="font-mono">
                    R {line.price.toFixed(2)}
                  </TableCell>

                  <TableCell className="font-mono font-bold text-blue-700">
                    R {line.total.toFixed(2)}
                  </TableCell>

                  <TableCell>
                    <Button variant="ghost" onClick={() => removeLine(i)}>
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="p-4">
            <Button onClick={addLine} className="bg-[#2563EB] text-white">
              <Plus size={16} className="mr-2" />
              Add Line
            </Button>
          </div>

        </div>

        {/* TOTALS */}
        <div className="bg-slate-50 p-4 rounded border space-y-2 text-right">

          <div>Subtotal: <b>R {subtotal.toFixed(2)}</b></div>
          <div>VAT (15%): <b>R {vat.toFixed(2)}</b></div>
          <div className="text-lg">Total: <b>R {total.toFixed(2)}</b></div>

        </div>

      </div>
    </Layout>
  );
}
