import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

import { Save, Search, Warehouse, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (value) => `${(Number(value) || 0).toFixed(2)}`;

export default function StockPage() {
  const { user } = useAuth();
  const canEditStock = ['MD_ADMIN', 'PROCUREMENT'].includes(user?.role);

  const [stockRows, setStockRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    loadStock();
  }, []);

  const loadStock = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stock');
      setStockRows(response.data || []);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  const updateLocal = (materialId, field, value) => {
    setStockRows((rows) =>
      rows.map((row) =>
        row.material_id === materialId ? { ...row, [field]: value } : row
      )
    );
  };

  const saveStock = async (row) => {
    try {
      setSavingId(row.material_id);
      await api.put(`/stock/${row.material_id}`, {
        id: row.id,
        current_stock: row.current_stock,
        reserved_stock: row.reserved_stock,
        minimum_stock: row.minimum_stock,
        notes: row.notes,
      });
      toast.success('Stock updated');
      loadStock();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update stock');
    } finally {
      setSavingId(null);
    }
  };

  const categories = useMemo(() => {
    return ['ALL', ...new Set(stockRows.map((row) => row.material_type).filter(Boolean))];
  }, [stockRows]);

  const filteredRows = stockRows.filter((row) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      row.material_name?.toLowerCase().includes(term) ||
      row.supplier?.toLowerCase().includes(term) ||
      row.material_type?.toLowerCase().includes(term);

    const matchesCategory = categoryFilter === 'ALL' || row.material_type === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const statusBadge = (status) => {
    if (status === 'OUT_OF_STOCK') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
          <AlertTriangle size={13} /> Out
        </span>
      );
    }

    if (status === 'LOW_STOCK') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
          <AlertTriangle size={13} /> Low
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
        <CheckCircle size={13} /> OK
      </span>
    );
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div>
          <h1 className="text-4xl font-black tracking-tight leading-none">Stock</h1>
          <p className="text-slate-600 mt-2">
            Audit current stock, track available quantities, and flag shortages against production requirements.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Search</label>
            <div className="relative mt-2">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search material, supplier, or category"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'ALL' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table className="w-full min-w-[1150px] text-sm">
              <TableHeader className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <TableRow>
                  <TableHead className="px-4 py-3">Material</TableHead>
                  <TableHead className="px-4 py-3">Category</TableHead>
                  <TableHead className="px-4 py-3">Supplier</TableHead>
                  <TableHead className="px-4 py-3">Stock</TableHead>
                  <TableHead className="px-4 py-3">Reserved</TableHead>
                  <TableHead className="px-4 py-3">Available</TableHead>
                  <TableHead className="px-4 py-3">Minimum</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="px-4 py-3">Audit Note</TableHead>
                  <TableHead className="px-4 py-3 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y">
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-slate-500">
                      No stock items found. Add materials first in the Materials page.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.material_id}>
                      <TableCell className="px-4 py-3">
                        <div className="font-semibold">{row.material_name}</div>
                        <div className="text-xs text-slate-500">
                          {row.width ? `${row.width}mm` : ''}{row.height ? ` x ${row.height}mm` : ''}{row.length_mm ? ` x ${row.length_mm / 1000}m` : ''}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3">{row.material_type}</TableCell>
                      <TableCell className="px-4 py-3">{row.supplier || '-'}</TableCell>

                      <TableCell className="px-4 py-3">
                        <Input
                          type="number"
                          value={row.current_stock}
                          disabled={!canEditStock}
                          onChange={(e) => updateLocal(row.material_id, 'current_stock', e.target.value)}
                        />
                        <div className="mt-1 text-xs text-slate-500">{row.unit_label}</div>
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Input
                          type="number"
                          value={row.reserved_stock}
                          disabled={!canEditStock}
                          onChange={(e) => updateLocal(row.material_id, 'reserved_stock', e.target.value)}
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3 font-semibold">
                        {fmt(row.available_stock)} {row.unit_label}
                      </TableCell>

                      <TableCell className="px-4 py-3">
                        <Input
                          type="number"
                          value={row.minimum_stock}
                          disabled={!canEditStock}
                          onChange={(e) => updateLocal(row.material_id, 'minimum_stock', e.target.value)}
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3">{statusBadge(row.stock_status)}</TableCell>

                      <TableCell className="px-4 py-3">
                        <Input
                          value={row.notes || ''}
                          disabled={!canEditStock}
                          onChange={(e) => updateLocal(row.material_id, 'notes', e.target.value)}
                          placeholder="Audit note"
                        />
                        {row.last_audited_at && (
                          <div className="mt-1 text-xs text-slate-500">
                            Last audit: {new Date(row.last_audited_at).toLocaleDateString()}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="px-4 py-3 text-right">
                        {canEditStock ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveStock(row)}
                            disabled={savingId === row.material_id}
                          >
                            <Save size={16} className="mr-2" />
                            Save
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-500">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Layout>
  );
}
