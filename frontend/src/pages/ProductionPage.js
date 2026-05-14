import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Factory, Search, RefreshCw, Clock, Users, Wrench, Truck } from 'lucide-react';
import { toast } from 'sonner';

const SETUP_MINUTES = 15;
const REMOVAL_MINUTES = 15;

const statusOptions = [
  'Not Started',
  'Ready',
  'In Progress',
  'Waiting',
  'Stuck',
  'Done',
];

const statusClasses = {
  'Not Started': 'bg-slate-200 text-slate-700',
  Ready: 'bg-sky-500 text-white',
  'In Progress': 'bg-amber-400 text-white',
  Waiting: 'bg-orange-400 text-white',
  Stuck: 'bg-rose-500 text-white',
  Done: 'bg-emerald-500 text-white',
};

function formatHours(hours) {
  const value = Number(hours || 0);
  if (!value) return '0h';
  if (value < 1) return `${Math.round(value * 60)}min`;
  return `${value.toFixed(2).replace(/\.00$/, '')}h`;
}

function clean(value, fallback) {
  return String(value || '').trim() || fallback;
}

function addLine(lines, line) {
  const hours = Number(line.hours || 0);
  const setup = Number(line.setupMinutes || 0);
  const removal = Number(line.removalMinutes || 0);

  lines.push({
    id: `${line.type}-${lines.length + 1}`,
    type: line.type,
    group: line.group,
    resource: line.resource,
    item: line.item,
    description: line.description,
    qty: line.qty || '',
    hours,
    setupMinutes: setup,
    removalMinutes: removal,
    totalMinutes: (hours * 60) + setup + removal,
  });
}

function buildLines(job) {
  const lines = [];
  const blueprint = job?.blueprint || {};
  const estimateLines = blueprint.estimate_lines || [];
  const quoteLines = job?.lines || [];
  const labourItems = job?.labour_items || [];
  const installationItems = job?.installation_items || [];

  estimateLines.forEach((line, index) => {
    const item = clean(
      line.item_name || line.product_name || line.recipe_name || line.name || line.description,
      `Item ${index + 1}`
    );

    const qty = Number(line.quantity || 1);
    const size = `${line.width_mm || '-'} x ${line.height_mm || '-'} mm`;
    const breakdown = line.recipe_breakdown || line.breakdown || [];

    breakdown.forEach((entry) => {
      const type = String(entry.line_type || entry.type || '').toUpperCase();
      const name = clean(entry.name || entry.custom_name || entry.labour_type_name || entry.machine_name, 'Resource');
      const hours = Number(entry.hours || entry.quantity || entry.qty || 0);

      if (type.includes('MACHINE')) {
        addLine(lines, {
          type: 'MACHINE',
          group: 'Machines',
          resource: name,
          item,
          qty,
          hours,
          setupMinutes: SETUP_MINUTES,
          removalMinutes: REMOVAL_MINUTES,
          description: `${item} - ${size}`,
        });
      }

      if (type.includes('LABOUR') || type.includes('LABOR')) {
        addLine(lines, {
          type: 'LABOUR',
          group: 'Labour',
          resource: name,
          item,
          qty,
          hours,
          description: `${item} - ${size}`,
        });
      }
    });

    const fulfilmentType = String(line.fulfilment_type || '').toUpperCase();

    if (fulfilmentType === 'SITE_INSTALL') {
      addLine(lines, {
        type: 'INSTALLATION',
        group: 'Installation',
        resource: 'Installation Team',
        item,
        qty,
        hours: Number(line.install_hours || line.fulfilment_hours || 0),
        setupMinutes: SETUP_MINUTES,
        removalMinutes: REMOVAL_MINUTES,
        description: line.fulfilment_note || `Install ${item}`,
      });
    }

    if (fulfilmentType === 'DELIVERY') {
      addLine(lines, {
        type: 'DELIVERY',
        group: 'Delivery',
        resource: 'Delivery',
        item,
        qty,
        hours: Number(line.delivery_hours || 0),
        description: line.fulfilment_note || `Deliver ${item}`,
      });
    }
  });

  quoteLines.forEach((line) => {
    (line.line_items || []).forEach((entry) => {
      const type = String(entry.type || entry.line_type || '').toUpperCase();
      const item = clean(line.recipe_name, 'Quoted item');
      const hours = Number(entry.hours || entry.quantity || 0);

      if (type.includes('MACHINE')) {
        addLine(lines, {
          type: 'MACHINE',
          group: 'Machines',
          resource: clean(entry.name, 'Machine'),
          item,
          qty: line.quantity || 1,
          hours,
          setupMinutes: SETUP_MINUTES,
          removalMinutes: REMOVAL_MINUTES,
          description: item,
        });
      }

      if (type.includes('LABOUR') || type.includes('LABOR')) {
        addLine(lines, {
          type: 'LABOUR',
          group: 'Labour',
          resource: clean(entry.name, 'Labour'),
          item,
          qty: line.quantity || 1,
          hours,
          description: item,
        });
      }
    });
  });

  labourItems.forEach((item) => {
    addLine(lines, {
      type: 'LABOUR',
      group: 'Labour',
      resource: clean(item.labour_type_name, 'Labour'),
      item: 'General Labour',
      qty: 1,
      hours: Number(item.hours || 0),
      description: item.notes || 'General labour',
    });
  });

  installationItems.forEach((item) => {
    addLine(lines, {
      type: 'INSTALLATION',
      group: 'Installation',
      resource: clean(item.install_type_name, 'Installation'),
      item: 'Installation',
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
      resource: clean(job.travel.vehicle_type, 'Vehicle'),
      item: 'Travel',
      qty: 1,
      hours: 0,
      description: 'Delivery / travel linked to job',
    });
  }

  return lines;
}

function getIcon(type) {
  if (type === 'MACHINE') return <Factory size={16} className="text-orange-600" />;
  if (type === 'LABOUR') return <Users size={16} className="text-blue-600" />;
  if (type === 'INSTALLATION') return <Wrench size={16} className="text-green-600" />;
  if (type === 'DELIVERY') return <Truck size={16} className="text-emerald-600" />;
  return <Clock size={16} className="text-slate-500" />;
}

function StatusCell({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-full min-h-[42px] w-full rounded-none border-0 px-2 text-center text-xs font-bold outline-none ${statusClasses[value] || statusClasses['Not Started']}`}
    >
      {statusOptions.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </select>
  );
}

export default function ProductionPage() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);

  const loadJobs = async () => {
    try {
      setLoading(true);

      // Only jobs posted to production should be returned here once the backend /production route is active.
      const response = await api.get('/production');
      const loadedJobs = response.data || [];
      setJobs(loadedJobs);

      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('jobId');

      if (jobId) {
        setSelectedJobId(jobId);
      } else if (loadedJobs.length && !selectedJobId) {
        setSelectedJobId(loadedJobs[0].id);
      }
    } catch {
      toast.error('Failed to load production jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedJob = jobs.find((job) => job.id === selectedJobId) || jobs[0] || null;

  const lines = useMemo(() => buildLines(selectedJob), [selectedJob]);

  const filteredLines = lines.filter((line) => {
    const term = search.toLowerCase();
    return (
      line.group.toLowerCase().includes(term) ||
      line.resource.toLowerCase().includes(term) ||
      line.item.toLowerCase().includes(term) ||
      line.description.toLowerCase().includes(term)
    );
  });

  const activeLines = filteredLines.filter((line) => (statuses[line.id] || 'Not Started') !== 'Done');
  const completedLines = filteredLines.filter((line) => (statuses[line.id] || 'Not Started') === 'Done');

  const totalMinutes = lines.reduce((sum, line) => sum + line.totalMinutes, 0);
  const machineMinutes = lines.filter((line) => line.type === 'MACHINE').reduce((sum, line) => sum + line.totalMinutes, 0);
  const labourMinutes = lines.filter((line) => line.type === 'LABOUR').reduce((sum, line) => sum + line.totalMinutes, 0);
  const installMinutes = lines.filter((line) => line.type === 'INSTALLATION').reduce((sum, line) => sum + line.totalMinutes, 0);

  const setStatus = (lineId, stage, value) => {
    setStatuses((current) => ({
      ...current,
      [`${lineId}-${stage}`]: value,
      ...(stage === 'production' ? { [lineId]: value } : {}),
    }));
  };

  const getStatus = (lineId, stage, fallback = 'Not Started') => {
    return statuses[`${lineId}-${stage}`] || fallback;
  };

  const renderRows = (rows, emptyText) => {
    if (!rows.length) {
      return (
        <div className="grid grid-cols-[290px_90px_140px_140px_140px_140px_130px_130px] border-b text-sm">
          <div className="col-span-8 px-4 py-8 text-center text-slate-500">{emptyText}</div>
        </div>
      );
    }

    return rows.map((line) => {
      const productionStatus = statuses[line.id] || 'Not Started';

      return (
        <div
          key={line.id}
          className="grid grid-cols-[290px_90px_140px_140px_140px_140px_130px_130px] border-b text-sm"
        >
          <div className="border-r bg-white px-4 py-3">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              {getIcon(line.type)}
              {line.item}
            </div>
            <div className="mt-1 text-xs text-slate-500">{line.description}</div>
          </div>

          <div className="flex items-center justify-center border-r bg-white text-center text-sm font-semibold text-slate-700">
            {line.resource}
          </div>

          <div className="border-r">
            <StatusCell
              value={getStatus(line.id, 'prep', line.type === 'MACHINE' || line.type === 'INSTALLATION' ? 'Ready' : 'Not Started')}
              onChange={(value) => setStatus(line.id, 'prep', value)}
            />
          </div>

          <div className="border-r">
            <StatusCell
              value={getStatus(line.id, 'setup', line.setupMinutes ? 'Ready' : 'Not Started')}
              onChange={(value) => setStatus(line.id, 'setup', value)}
            />
          </div>

          <div className="border-r">
            <StatusCell
              value={productionStatus}
              onChange={(value) => setStatus(line.id, 'production', value)}
            />
          </div>

          <div className="border-r">
            <StatusCell
              value={getStatus(line.id, 'removal', line.removalMinutes ? 'Ready' : 'Not Started')}
              onChange={(value) => setStatus(line.id, 'removal', value)}
            />
          </div>

          <div className="flex items-center justify-center border-r bg-slate-50 px-3 text-center text-xs font-semibold text-slate-700">
            Work: {formatHours(line.hours)}
            <br />
            Setup: {line.setupMinutes}m
            <br />
            Removal: {line.removalMinutes}m
          </div>

          <div className="flex items-center justify-center bg-slate-50 px-3 text-center text-xs font-black text-slate-900">
            {formatHours(line.totalMinutes / 60)}
          </div>
        </div>
      );
    });
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Production Tracking</h1>
            <p className="mt-2 text-slate-600">
              Track posted production jobs through preparation, setup, production, removal and completion.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={loadJobs} className="gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
            <div>
              <label className="text-sm font-semibold">Production Job</label>
              <select
                value={selectedJob?.id || ''}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.invoice_number || job.quote_number || 'Job'} - {job.client_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-black text-slate-900">{selectedJob?.client_name || 'No job selected'}</div>
              <div>Invoice: {selectedJob?.invoice_number || '-'}</div>
              <div>Status: {selectedJob?.production_status || 'Queued'}</div>
              <div>Total: R {Number(selectedJob?.total_amount || 0).toFixed(2)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Lines</div>
                <div className="text-2xl font-black">{lines.length}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Total Time</div>
                <div className="text-2xl font-black">{formatHours(totalMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Machines</div>
                <div className="text-xl font-black text-orange-600">{formatHours(machineMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Labour</div>
                <div className="text-xl font-black text-blue-600">{formatHours(labourMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Installation</div>
                <div className="text-xl font-black text-green-600">{formatHours(installMinutes / 60)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Auto Time</div>
                <div className="text-xl font-black text-purple-600">15m + 15m</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black">Production Board</h2>
                <p className="text-sm text-slate-500">
                  Each machine and installation line includes automatic setup and removal time.
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search board"
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading production jobs...</div>
            ) : !selectedJob ? (
              <div className="p-12 text-center text-slate-500">No jobs have been posted to production yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[1200px]">
                  <div className="grid grid-cols-[290px_90px_140px_140px_140px_140px_130px_130px] border-b bg-white text-xs font-black uppercase tracking-wide text-slate-500">
                    <div className="border-r px-4 py-3">Item</div>
                    <div className="border-r px-4 py-3 text-center">Owner</div>
                    <div className="border-r px-4 py-3 text-center">Preparation</div>
                    <div className="border-r px-4 py-3 text-center">Setup</div>
                    <div className="border-r px-4 py-3 text-center">Production</div>
                    <div className="border-r px-4 py-3 text-center">Removal</div>
                    <div className="border-r px-4 py-3 text-center">Time</div>
                    <div className="px-4 py-3 text-center">Total</div>
                  </div>

                  <div className="border-l-4 border-purple-500">
                    <div className="border-b bg-purple-50 px-4 py-2 text-sm font-black text-purple-700">
                      Active
                    </div>
                    {renderRows(activeLines, 'No active production lines.')}
                  </div>

                  <div className="mt-6 border-l-4 border-emerald-500">
                    <div className="border-b bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                      Completed
                    </div>
                    {renderRows(completedLines, 'No completed production lines yet.')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
