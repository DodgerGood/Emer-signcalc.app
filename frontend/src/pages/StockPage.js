import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import ActionIconButton from '../components/ActionIconButton';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [dirtyRows, setDirtyRows] = useState({});

  const itemsPerPage = 10;

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    const hasUnsavedChanges = Object.keys(dirtyRows).length > 0;

    const beforeUnload = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirtyRows]);

  const downloadStockTake = async () => {
    try {
      const response = await api.get('/stock/export/stock-take', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.setAttribute('download', 'stock-take-sheet.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      toast.success('Stock take sheet downloaded');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download stock take sheet');
    }
  };

  const loadStock = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stock');
      setStockRows(response.data || []);
      setCurrentPage(1);
      setDirtyRows({});
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

    setDirtyRows((rows) => ({
      ...rows,
      [materialId]: true,
    }));
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
      setDirtyRows((rows) => {
        const next = { ...rows };
        delete next[row.material_id];
        return next;
      });
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

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
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Stock</h1>
            <p className="text-slate-600 mt-2">
              Audit current stock, track available quantities, and flag shortages against production requirements.
            </p>
          </div>

          <Button
            type="button"
            onClick={downloadStockTake}
            className="bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
          >
            <Download size={18} className="mr-2" />
            Stock Take Excel
          </Button>
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
                  paginatedRows.map((row) => (
                    <TableRow key={row.material_id} className="align-top">
                      <TableCell className="px-4 py-3 align-top">
                        <div className="font-semibold">{row.material_name}</div>
                        <div className="text-xs text-slate-500">
                          {row.width ? `${row.width}mm` : ''}{row.height ? ` x ${row.height}mm` : ''}{row.length_mm ? ` x ${row.length_mm / 1000}m` : ''}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3 align-top">{row.material_type}</TableCell>
                      <TableCell className="px-4 py-3 align-top">{row.supplier || '-'}</TableCell>

                      <TableCell className="px-4 py-3 align-top">
                        <Input
                          type="number"
                          value={row.current_stock}
                          disabled={!canEditStock}
                          onChange={(e) => updateLocal(row.material_id, 'current_stock', e.target.value)}
                        />
                        <div className="mt-1 text-xs text-slate-500">{row.unit_label}</div>
                      </TableCell>

                      <TableCell className="px-4 py-3 align-top">
                        <Input
                          type="number"
                          value={row.reserved_stock}
                          disabled={!canEditStock}
                          onChange={(e) => updateLocal(row.material_id, 'reserved_stock', e.target.value)}
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3 align-top font-semibold">
                        {fmt(row.available_stock)} {row.unit_label}
                      </TableCell>

                      <TableCell className="px-4 py-3 align-top">
                        <Input
                          type="number"
                          value={row.minimum_stock}
                          disabled={!canEditStock}
                          onChange={(e) => updateLocal(row.material_id, 'minimum_stock', e.target.value)}
                        />
                      </TableCell>

                      <TableCell className="px-4 py-3 align-top">{statusBadge(row.stock_status)}</TableCell>

                      <TableCell className="px-4 py-3 align-top">
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

                      <TableCell className="px-4 py-3 align-top text-right">
                        {canEditStock ? (
                          <div className="flex flex-col items-end gap-1">
                            <ActionIconButton
                              icon={<Save size={16} />}
                              label="Save"
                              tone="pdf"
                              onClick={() => saveStock(row)}
                              disabled={savingId === row.material_id}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            />
                            {dirtyRows[row.material_id] && (
                              <span className="text-xs font-medium text-amber-600">
                                Unsaved
                              </span>
                            )}
                          </div>
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

        {!loading && filteredRows.length > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-600">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredRows.length)} of {filteredRows.length}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>

              <span className="px-3">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                type="button"
                variant="outline"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
