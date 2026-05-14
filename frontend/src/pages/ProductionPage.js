import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Factory, Clock, UserRound, Wrench, Truck, Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const SETUP_MINUTES = 15;
const REMOVAL_MINUTES = 15;

const statusStyles = {
  QUEUED: 'bg-slate-100 text-slate-700 border-slate-200',
  READY: 'bg-blue-50 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  DONE: 'bg-green-50 text-green-700 border-green-200',
};

const statusLabels = {
  QUEUED: 'Queued',
  READY: 'Ready',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

function formatHours(hours) {
  const value = Number(hours || 0);
  if (!value) return '0h';
  if (value < 1) return `${Math.round(value * 60)}min`;
  return `${value.toFixed(2).replace(/\.00$/, '')}h`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-ZA');
}

function getJobTitle(job) {
  return `${job.invoice_number || job.quote_number || job.estimate_number || 'Job'} - ${job.client_name || 'Client'}`;
}

function cleanName(value, fallback) {
  const text = String(value || '').trim();
  return text || fallback;
}

function addLine(lines, line) {
  const minutes = Number(line.minutes || 0);
  const hours = Number(line.hours || minutes / 60 || 0);

  lines.push({
    id: `${line.type}-${lines.length + 1}-${Math.random().toString(36).slice(2)}`,
    type: line.type,
    group: line.group,
    resource: line.resource,
    description: line.description,
    itemName: line.itemName,
    qty: line.qty,
    hours,
    minutes: hours * 60,
    setupMinutes: line.setupMinutes || 0,
    removalMinutes: line.removalMinutes || 0,
    totalMinutes: (hours * 60) + (line.setupMinutes || 0) + (line.removalMinutes || 0),
    status: line.status || 'QUEUED',
  });
}

function buildProductionLines(job) {
  const lines = [];
  const blueprint = job?.blueprint || {};
  const estimateLines = blueprint.estimate_lines || [];
  const quoteLines = job?.lines || [];
  const labourItems = job?.labour_items || [];
  const installationItems = job?.installation_items || [];

  estimateLines.forEach((line, index) => {
    const itemName = cleanName(
      line.item_name || line.product_name || line.recipe_name || line.name || line.description,
      `Item ${index + 1}`
    );

    const qty = Number(line.quantity || 1);
    const width = line.width_mm || '-';
    const height = line.height_mm || '-';

    const recipeBreakdown = line.recipe_breakdown || line.breakdown || [];
    const labourBreakdown = recipeBreakdown.filter((entry) => {
      const type = String(entry.line_type || entry.type || '').toUpperCase();
      return type.includes('LABOUR') || type.includes('LABOR');
    });

    const machineBreakdown = recipeBreakdown.filter((entry) => {
      const type = String(entry.line_type || entry.type || '').toUpperCase();
      return type.includes('MACHINE');
    });

    labourBreakdown.forEach((entry) => {
      const hours = Number(entry.hours || entry.quantity || entry.qty || 0);
      addLine(lines, {
        type: 'LABOUR',
        group: 'Labour',
        resource: cleanName(entry.name || entry.labour_type_name || entry.custom_name, 'Labour'),
        itemName,
        qty,
        hours,
        description: `${itemName} - ${width} x ${height} mm`,
      });
    });

    machineBreakdown.forEach((entry) => {
      const hours = Number(entry.hours || entry.quantity || entry.qty || 0);
      addLine(lines, {
        type: 'MACHINE',
        group: 'Machine',
        resource: cleanName(entry.name || entry.machine_name || entry.custom_name, 'Machine'),
        itemName,
        qty,
        hours,
        setupMinutes: SETUP_MINUTES,
        removalMinutes: REMOVAL_MINUTES,
        description: `${itemName} - ${width} x ${height} mm`,
      });
    });

    if (!labourBreakdown.length && Number(line.labour_hours || 0) > 0) {
      addLine(lines, {
        type: 'LABOUR',
        group: 'Labour',
        resource: cleanName(line.labour_type_name, 'Labour'),
        itemName,
        qty,
        hours: Number(line.labour_hours || 0),
        description: `${itemName} - ${width} x ${height} mm`,
      });
    }

    if (!machineBreakdown.length && Number(line.machine_hours || line.production_hours || 0) > 0) {
      addLine(lines, {
        type: 'MACHINE',
        group: 'Machine',
        resource: cleanName(line.machine_name || line.production_machine_name, 'Machine'),
        itemName,
        qty,
        hours: Number(line.machine_hours || line.production_hours || 0),
        setupMinutes: SETUP_MINUTES,
        removalMinutes: REMOVAL_MINUTES,
        description: `${itemName} - ${width} x ${height} mm`,
      });
    }

    const fulfilmentType = String(line.fulfilment_type || '').toUpperCase();
    if (fulfilmentType === 'SITE_INSTALL') {
      addLine(lines, {
        type: 'INSTALLATION',
        group: 'Installation',
        resource: 'Install Team',
        itemName,
        qty,
        hours: Number(line.install_hours || line.fulfilment_hours || 0),
        setupMinutes: SETUP_MINUTES,
        removalMinutes: REMOVAL_MINUTES,
        description: line.fulfilment_note || `Install ${itemName}`,
      });
    }

    if (fulfilmentType === 'DELIVERY') {
      addLine(lines, {
        type: 'DELIVERY',
        group: 'Delivery',
        resource: 'Delivery',
        itemName,
        qty,
        hours: Number(line.delivery_hours || 0),
        description: line.fulfilment_note || `Deliver ${itemName}`,
      });
    }
  });

  quoteLines.forEach((line) => {
    (line.line_items || []).forEach((entry) => {
      const type = String(entry.type || entry.line_type || '').toUpperCase();

      if (type.includes('LABOUR') || type.includes('LABOR')) {
        addLine(lines, {
          type: 'LABOUR',
          group: 'Labour',
          resource: cleanName(entry.name, 'Labour'),
          itemName: cleanName(line.recipe_name, 'Quoted Item'),
          qty: Number(line.quantity || 1),
          hours: Number(entry.hours || entry.quantity || 0),
          description: cleanName(line.recipe_name, 'Quoted Item'),
        });
      }

      if (type.includes('MACHINE')) {
        addLine(lines, {
          type: 'MACHINE',
          group: 'Machine',
          resource: cleanName(entry.name, 'Machine'),
          itemName: cleanName(line.recipe_name, 'Quoted Item'),
          qty: Number(line.quantity || 1),
          hours: Number(entry.hours || entry.quantity || 0),
          setupMinutes: SETUP_MINUTES,
          removalMinutes: REMOVAL_MINUTES,
          description: cleanName(line.recipe_name, 'Quoted Item'),
        });
      }
    });
  });

  labourItems.forEach((item) => {
    addLine(lines, {
      type: 'LABOUR',
      group: 'Labour',
      resource: cleanName(item.labour_type_name, 'Labour'),
      itemName: 'General Labour',
      qty: 1,
      hours: Number(item.hours || 0),
      description: item.notes || 'General labour',
    });
  });

  installationItems.forEach((item) => {
    addLine(lines, {
      type: 'INSTALLATION',
      group: 'Installation',
      resource: cleanName(item.install_type_name, 'Installation'),
      itemName: 'Installation',
      qty: 1,
      hours: Number(item.hours || 0),
      setupMinutes: SETUP_MINUTES,
      removalMinutes: REMOVAL_MINUTES,
      description: item.notes || 'Installation',
    });
  });

  if (job?.travel) {
    addLine(lines, {
      type: 'DELIVERY',
      group: 'Delivery / Travel',
      resource: cleanName(job.travel.vehicle_type, 'Vehicle'),
      itemName: 'Travel',
      qty: 1,
      hours: 0,
      description: `Travel / delivery: ${job.travel.vehicle_type || 'Vehicle'}`,
    });
  }

  return lines;
}

function groupLines(lines) {
  return lines.reduce((acc, line) => {
    if (!acc[line.group]) acc[line.group] = [];
    acc[line.group].push(line);
    return acc;
  }, {});
}

export default function ProductionPage() {
  const [approvedJobs, setApprovedJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lineStatuses, setLineStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('jobId') || '';
    setSelectedJobId(jobId);
    loadApprovedJobs(jobId);
  }, []);

  const loadApprovedJobs = async (preferredJobId = '') => {
    try {
      setLoading(true);
      const response = await api.get('/approved');
      const jobs = response.data || [];
      setApprovedJobs(jobs);

      if (!preferredJobId && jobs.length > 0) {
        setSelectedJobId(jobs[0].id);
      }
    } catch {
      toast.error('Failed to load production jobs');
    } finally {
      setLoading(false);
    }
  };

  const selectedJob = useMemo(() => {
    return approvedJobs.find((job) => job.id === selectedJobId) || approvedJobs[0] || null;
  }, [approvedJobs, selectedJobId]);

  const productionLines = useMemo(() => {
    return buildProductionLines(selectedJob);
  }, [selectedJob]);

  const filteredLines = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return productionLines.filter((line) => (
      line.resource?.toLowerCase().includes(term) ||
      line.description?.toLowerCase().includes(term) ||
      line.itemName?.toLowerCase().includes(term) ||
      line.group?.toLowerCase().includes(term)
    ));
  }, [productionLines, searchTerm]);

  const grouped = groupLines(filteredLines);

  const totals = useMemo(() => {
    const machineMinutes = productionLines
      .filter((line) => line.type === 'MACHINE')
      .reduce((sum, line) => sum + line.totalMinutes, 0);

    const labourMinutes = productionLines
      .filter((line) => line.type === 'LABOUR')
      .reduce((sum, line) => sum + line.totalMinutes, 0);

    const installMinutes = productionLines
      .filter((line) => line.type === 'INSTALLATION')
      .reduce((sum, line) => sum + line.totalMinutes, 0);

    return {
      totalMinutes: productionLines.reduce((sum, line) => sum + line.totalMinutes, 0),
      machineMinutes,
      labourMinutes,
      installMinutes,
      lineCount: productionLines.length,
    };
  }, [productionLines]);

  const updateStatus = (lineId, status) => {
    setLineStatuses((current) => ({
      ...current,
      [lineId]: status,
    }));
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Production Tracking</h1>
            <p className="text-slate-600 mt-2">
              Track machines, labour, installation and delivery work from approved jobs.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => loadApprovedJobs(selectedJobId)}
            className="gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Approved Job</label>
              <select
                value={selectedJob?.id || ''}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {approvedJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {getJobTitle(job)}
                  </option>
                ))}
              </select>
            </div>

            {selectedJob && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 space-y-2">
                <div className="font-bold text-slate-900">{selectedJob.client_name}</div>
                <div>Invoice: {selectedJob.invoice_number || '-'}</div>
                <div>Approved: {formatDate(selectedJob.invoice_created_at || selectedJob.approved_at)}</div>
                <div>Total job value: R {Number(selectedJob.total_amount || 0).toFixed(2)}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-slate-500">Lines</div>
                <div className="text-2xl font-black text-slate-900">{totals.lineCount}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-slate-500">Total Time</div>
                <div className="text-2xl font-black text-slate-900">{formatHours(totals.totalMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-slate-500">Machine</div>
                <div className="text-xl font-black text-orange-600">{formatHours(totals.machineMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-slate-500">Labour</div>
                <div className="text-xl font-black text-blue-600">{formatHours(totals.labourMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-slate-500">Installation</div>
                <div className="text-xl font-black text-green-600">{formatHours(totals.installMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border bg-white p-3">
                <div className="text-xs text-slate-500">Setup / Removal</div>
                <div className="text-xl font-black text-purple-600">15m + 15m</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Production Board</h2>
                <p className="text-sm text-slate-500">
                  Machine lines include automatic 15min setup and 15min removal.
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search production lines"
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center p-12">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-accent" />
              </div>
            ) : !selectedJob ? (
              <div className="p-12 text-center text-slate-500">
                No approved jobs available for production tracking.
              </div>
            ) : productionLines.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                No machine, labour or installation information found for this approved job yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[1100px]">
                  <div className="grid grid-cols-[170px_240px_1fr_90px_120px_120px_160px] border-b bg-white px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <div>Group</div>
                    <div>Resource</div>
                    <div>Description</div>
                    <div>Qty</div>
                    <div>Work Time</div>
                    <div>Total Time</div>
                    <div>Status</div>
                  </div>

                  {Object.entries(grouped).map(([groupName, lines]) => (
                    <div key={groupName}>
                      <div className="border-b bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-600">
                        {groupName}
                      </div>

                      {lines.map((line) => {
                        const status = lineStatuses[line.id] || line.status || 'QUEUED';

                        return (
                          <div
                            key={line.id}
                            className="grid grid-cols-[170px_240px_1fr_90px_120px_120px_160px] items-center border-b px-4 py-4 text-sm hover:bg-slate-50"
                          >
                            <div className="flex items-center gap-2 font-semibold text-slate-800">
                              {line.type === 'MACHINE' && <Factory size={16} className="text-orange-600" />}
                              {line.type === 'LABOUR' && <UserRound size={16} className="text-blue-600" />}
                              {line.type === 'INSTALLATION' && <Wrench size={16} className="text-green-600" />}
                              {line.type === 'DELIVERY' && <Truck size={16} className="text-emerald-600" />}
                              {!['MACHINE', 'LABOUR', 'INSTALLATION', 'DELIVERY'].includes(line.type) && <Clock size={16} className="text-slate-600" />}
                              {line.group}
                            </div>

                            <div className="font-medium text-slate-900">{line.resource}</div>

                            <div>
                              <div className="font-semibold text-slate-900">{line.itemName}</div>
                              <div className="text-xs text-slate-500">{line.description}</div>
                              {(line.setupMinutes || line.removalMinutes) ? (
                                <div className="mt-1 text-[11px] text-purple-600">
                                  Setup {line.setupMinutes}min + Removal {line.removalMinutes}min
                                </div>
                              ) : null}
                            </div>

                            <div>{line.qty || '-'}</div>
                            <div>{formatHours(line.hours)}</div>
                            <div className="font-bold text-slate-900">{formatHours(line.totalMinutes / 60)}</div>

                            <div>
                              <select
                                value={status}
                                onChange={(e) => updateStatus(line.id, e.target.value)}
                                className={`w-full rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[status] || statusStyles.QUEUED}`}
                              >
                                <option value="QUEUED">{statusLabels.QUEUED}</option>
                                <option value="READY">{statusLabels.READY}</option>
                                <option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option>
                                <option value="DONE">{statusLabels.DONE}</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
