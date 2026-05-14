import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  CalendarDays,
  Factory,
  Users,
  Wrench,
  Truck,
  PackageCheck,
  ClipboardList,
  FileCheck,
  Search,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const WORKDAY_MINUTES = 8 * 60;
const SETUP_MINUTES = 15;
const REMOVAL_MINUTES = 15;

const statusOptions = ['Not Started', 'Ready', 'In Progress', 'Waiting', 'Blocked', 'Done'];

const statusClasses = {
  'Not Started': 'bg-slate-100 text-slate-600 border-slate-200',
  Ready: 'bg-sky-100 text-sky-700 border-sky-200',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200',
  Waiting: 'bg-orange-100 text-orange-700 border-orange-200',
  Blocked: 'bg-rose-100 text-rose-700 border-rose-200',
  Done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const departmentClasses = {
  ADMIN: 'bg-slate-500',
  DESIGN: 'bg-purple-500',
  PROCUREMENT: 'bg-cyan-500',
  STOCK: 'bg-blue-500',
  MACHINE: 'bg-orange-500',
  LABOUR: 'bg-indigo-500',
  QC: 'bg-emerald-500',
  PACKING: 'bg-amber-500',
  DISPATCH: 'bg-teal-500',
  INSTALLATION: 'bg-green-500',
  CLOSE: 'bg-slate-700',
};

function clean(value, fallback) {
  return String(value || '').trim() || fallback;
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(date) {
  return formatDateInput(date);
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function formatHours(minutes) {
  const value = Number(minutes || 0);
  if (!value) return '0h';
  if (value < 60) return `${Math.round(value)}min`;
  return `${(value / 60).toFixed(2).replace(/\.00$/, '')}h`;
}

function getIcon(department) {
  if (department === 'DESIGN') return <FileCheck size={16} className="text-purple-600" />;
  if (department === 'PROCUREMENT') return <PackageCheck size={16} className="text-cyan-600" />;
  if (department === 'STOCK') return <PackageCheck size={16} className="text-blue-600" />;
  if (department === 'MACHINE') return <Factory size={16} className="text-orange-600" />;
  if (department === 'LABOUR') return <Users size={16} className="text-indigo-600" />;
  if (department === 'INSTALLATION') return <Wrench size={16} className="text-green-600" />;
  if (department === 'DISPATCH') return <Truck size={16} className="text-teal-600" />;
  return <ClipboardList size={16} className="text-slate-600" />;
}

function makeStep({
  id,
  group,
  name,
  department,
  owner,
  plannedMinutes,
  dependsOn = [],
  canRunParallel = false,
  source = '',
}) {
  return {
    id,
    group,
    name,
    department,
    owner,
    plannedMinutes: Number(plannedMinutes || 0),
    dependsOn,
    canRunParallel,
    source,
  };
}

function extractProductionSteps(job) {
  const steps = [];
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

    breakdown.forEach((entry, entryIndex) => {
      const type = String(entry.line_type || entry.type || '').toUpperCase();
      const resource = clean(
        entry.name || entry.custom_name || entry.labour_type_name || entry.machine_name,
        'Resource'
      );

      const hours = Number(entry.hours || entry.quantity || entry.qty || 0);
      const baseMinutes = hours * 60;

      if (type.includes('MACHINE')) {
        steps.push(makeStep({
          id: `machine-${index}-${entryIndex}`,
          group: 'Production',
          name: `${resource} - ${item}`,
          department: 'MACHINE',
          owner: resource,
          plannedMinutes: baseMinutes + SETUP_MINUTES + REMOVAL_MINUTES,
          source: `${qty} x ${size}. Includes ${SETUP_MINUTES}min setup and ${REMOVAL_MINUTES}min removal.`,
        }));
      }

      if (type.includes('LABOUR') || type.includes('LABOR')) {
        steps.push(makeStep({
          id: `labour-${index}-${entryIndex}`,
          group: 'Production',
          name: `${resource} - ${item}`,
          department: 'LABOUR',
          owner: resource,
          plannedMinutes: baseMinutes,
          source: `${qty} x ${size}`,
        }));
      }
    });

    const fulfilmentType = String(line.fulfilment_type || '').toUpperCase();

    if (fulfilmentType === 'SITE_INSTALL') {
      steps.push(makeStep({
        id: `install-${index}`,
        group: 'Handover',
        name: `Installation - ${item}`,
        department: 'INSTALLATION',
        owner: 'Installation Team',
        plannedMinutes: Number(line.install_hours || line.fulfilment_hours || 0) * 60 + SETUP_MINUTES + REMOVAL_MINUTES,
        source: line.fulfilment_note || `Install ${item}`,
      }));
    }

    if (fulfilmentType === 'DELIVERY') {
      steps.push(makeStep({
        id: `delivery-${index}`,
        group: 'Handover',
        name: `Delivery - ${item}`,
        department: 'DISPATCH',
        owner: 'Dispatch',
        plannedMinutes: Number(line.delivery_hours || 0) * 60,
        source: line.fulfilment_note || `Deliver ${item}`,
      }));
    }
  });

  quoteLines.forEach((line, lineIndex) => {
    (line.line_items || []).forEach((entry, entryIndex) => {
      const type = String(entry.type || entry.line_type || '').toUpperCase();
      const item = clean(line.recipe_name, 'Quoted item');
      const resource = clean(entry.name, 'Resource');
      const minutes = Number(entry.hours || entry.quantity || 0) * 60;

      if (type.includes('MACHINE')) {
        steps.push(makeStep({
          id: `quote-machine-${lineIndex}-${entryIndex}`,
          group: 'Production',
          name: `${resource} - ${item}`,
          department: 'MACHINE',
          owner: resource,
          plannedMinutes: minutes + SETUP_MINUTES + REMOVAL_MINUTES,
          source: `Includes ${SETUP_MINUTES}min setup and ${REMOVAL_MINUTES}min removal.`,
        }));
      }

      if (type.includes('LABOUR') || type.includes('LABOR')) {
        steps.push(makeStep({
          id: `quote-labour-${lineIndex}-${entryIndex}`,
          group: 'Production',
          name: `${resource} - ${item}`,
          department: 'LABOUR',
          owner: resource,
          plannedMinutes: minutes,
          source: item,
        }));
      }
    });
  });

  labourItems.forEach((item, index) => {
    steps.push(makeStep({
      id: `manual-labour-${index}`,
      group: 'Production',
      name: clean(item.labour_type_name, 'Labour'),
      department: 'LABOUR',
      owner: clean(item.labour_type_name, 'Labour'),
      plannedMinutes: Number(item.hours || 0) * 60,
      source: item.notes || 'Manual labour item',
    }));
  });

  installationItems.forEach((item, index) => {
    steps.push(makeStep({
      id: `manual-install-${index}`,
      group: 'Handover',
      name: clean(item.install_type_name, 'Installation'),
      department: 'INSTALLATION',
      owner: clean(item.install_type_name, 'Installation'),
      plannedMinutes: Number(item.hours || 0) * 60 + SETUP_MINUTES + REMOVAL_MINUTES,
      source: item.notes || 'Manual installation item',
    }));
  });

  return steps;
}

function buildWorkflow(job) {
  const productionSteps = extractProductionSteps(job);

  const hasInstallation = productionSteps.some((step) => step.department === 'INSTALLATION');
  const hasDispatch = productionSteps.some((step) => step.department === 'DISPATCH') || job?.travel;

  const steps = [
    makeStep({
      id: 'job-pack',
      group: 'Pre-Production',
      name: 'Job Pack',
      department: 'ADMIN',
      owner: 'Admin',
      plannedMinutes: 30,
      source: 'Confirm invoice, job ticket, proof, and required documents.',
    }),
    makeStep({
      id: 'design',
      group: 'Pre-Production',
      name: 'Design',
      department: 'DESIGN',
      owner: 'Design',
      plannedMinutes: 60,
      dependsOn: ['job-pack'],
      canRunParallel: true,
      source: 'Prepare or confirm production artwork.',
    }),
    makeStep({
      id: 'procurement',
      group: 'Pre-Production',
      name: 'Procurement',
      department: 'PROCUREMENT',
      owner: 'Procurement',
      plannedMinutes: 60,
      dependsOn: ['job-pack'],
      canRunParallel: true,
      source: 'Check required bought-in items and supplier requirements.',
    }),
    makeStep({
      id: 'production-brief',
      group: 'Pre-Production',
      name: 'Production Brief',
      department: 'ADMIN',
      owner: 'Production',
      plannedMinutes: 30,
      dependsOn: ['job-pack'],
      canRunParallel: true,
      source: 'Brief production team on requirements and sequence.',
    }),
    makeStep({
      id: 'stock-issuing',
      group: 'Pre-Production',
      name: 'Stock Issuing',
      department: 'STOCK',
      owner: 'Stock',
      plannedMinutes: 30,
      dependsOn: ['procurement'],
      source: 'Issue stock and materials to production.',
    }),
  ];

  let previousProductionId = null;

  productionSteps
    .filter((step) => step.group === 'Production')
    .forEach((step, index) => {
      const id = `production-${step.id}`;

      steps.push({
        ...step,
        id,
        dependsOn: index === 0
          ? ['design', 'production-brief', 'stock-issuing']
          : [previousProductionId],
      });

      previousProductionId = id;
    });

  const productionDependency = previousProductionId
    ? [previousProductionId]
    : ['design', 'production-brief', 'stock-issuing'];

  steps.push(
    makeStep({
      id: 'qc',
      group: 'Quality & Handover',
      name: 'QC',
      department: 'QC',
      owner: 'Quality Control',
      plannedMinutes: 30,
      dependsOn: productionDependency,
      source: 'Quality check before packing.',
    }),
    makeStep({
      id: 'packing',
      group: 'Quality & Handover',
      name: 'Packing',
      department: 'PACKING',
      owner: 'Packing',
      plannedMinutes: 30,
      dependsOn: ['qc'],
      source: 'Pack and protect completed goods.',
    }),
    makeStep({
      id: 'dispatch',
      group: 'Quality & Handover',
      name: 'Dispatch',
      department: 'DISPATCH',
      owner: 'Dispatch',
      plannedMinutes: hasDispatch ? 45 : 15,
      dependsOn: ['packing'],
      source: 'Prepare goods for delivery, collection, or installation.',
    })
  );

  productionSteps
    .filter((step) => step.group === 'Handover' && step.department === 'INSTALLATION')
    .forEach((step, index) => {
      steps.push({
        ...step,
        id: `handover-install-${index}`,
        dependsOn: ['dispatch'],
      });
    });

  steps.push(
    makeStep({
      id: 'delivery-note-signed',
      group: 'Quality & Handover',
      name: 'Delivery Note Signed',
      department: 'DISPATCH',
      owner: hasInstallation ? 'Installer / Client' : 'Driver / Client',
      plannedMinutes: 15,
      dependsOn: hasInstallation
        ? productionSteps
            .filter((step) => step.group === 'Handover' && step.department === 'INSTALLATION')
            .map((_, index) => `handover-install-${index}`)
        : ['dispatch'],
      source: 'Confirm handover with signed delivery note.',
    }),
    makeStep({
      id: 'close-job',
      group: 'Close Out',
      name: 'Close Job',
      department: 'CLOSE',
      owner: 'Admin',
      plannedMinutes: 15,
      dependsOn: ['delivery-note-signed'],
      source: 'Final checks, job close-out, and filing.',
    })
  );

  return steps;
}

function scheduleWorkflow(steps, startDate) {
  const byId = Object.fromEntries(steps.map((step) => [step.id, step]));
  const scheduled = {};
  const result = [];

  function scheduleStep(step) {
    if (scheduled[step.id]) return scheduled[step.id];

    let startOffset = 0;

    if (step.dependsOn?.length) {
      const dependencyEnds = step.dependsOn
        .map((depId) => byId[depId])
        .filter(Boolean)
        .map((depStep) => scheduleStep(depStep).endOffset);

      startOffset = dependencyEnds.length ? Math.max(...dependencyEnds) : 0;
    }

    if (!step.canRunParallel && !step.dependsOn?.length && result.length) {
      startOffset = Math.max(...result.map((item) => item.endOffset));
    }

    const durationDays = Math.max(1, Math.ceil(Number(step.plannedMinutes || 1) / WORKDAY_MINUTES));
    const endOffset = startOffset + durationDays;

    const scheduledStep = {
      ...step,
      startOffset,
      endOffset,
      startDate: addDays(startDate, startOffset),
      endDate: addDays(startDate, endOffset - 1),
      durationDays,
    };

    scheduled[step.id] = scheduledStep;
    result.push(scheduledStep);
    return scheduledStep;
  }

  steps.forEach(scheduleStep);

  return result.sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
}

export default function ProductionPage() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [calendarStart, setCalendarStart] = useState(formatDateInput(new Date()));
  const [daysToShow, setDaysToShow] = useState(14);

  const loadJobs = async () => {
    try {
      setLoading(true);
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

  const workflowSteps = useMemo(() => buildWorkflow(selectedJob), [selectedJob]);
  const startDate = useMemo(() => {
    const date = new Date(calendarStart);
    if (Number.isNaN(date.getTime())) return new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, [calendarStart]);

  const scheduledSteps = useMemo(() => scheduleWorkflow(workflowSteps, startDate), [workflowSteps, startDate]);

  const calendarDays = useMemo(() => {
    return Array.from({ length: Number(daysToShow || 14) }, (_, index) => addDays(startDate, index));
  }, [startDate, daysToShow]);

  const filteredSteps = scheduledSteps.filter((step) => {
    const term = search.toLowerCase();

    return (
      step.name.toLowerCase().includes(term) ||
      step.group.toLowerCase().includes(term) ||
      step.department.toLowerCase().includes(term) ||
      step.owner.toLowerCase().includes(term) ||
      step.source.toLowerCase().includes(term)
    );
  });

  const groupedSteps = filteredSteps.reduce((acc, step) => {
    if (!acc[step.group]) acc[step.group] = [];
    acc[step.group].push(step);
    return acc;
  }, {});

  const totalMinutes = workflowSteps.reduce((sum, step) => sum + Number(step.plannedMinutes || 0), 0);
  const productionMinutes = workflowSteps
    .filter((step) => ['MACHINE', 'LABOUR'].includes(step.department))
    .reduce((sum, step) => sum + Number(step.plannedMinutes || 0), 0);
  const installMinutes = workflowSteps
    .filter((step) => step.department === 'INSTALLATION')
    .reduce((sum, step) => sum + Number(step.plannedMinutes || 0), 0);

  const activeCount = workflowSteps.filter((step) => (statuses[step.id] || 'Not Started') !== 'Done').length;
  const completeCount = workflowSteps.filter((step) => (statuses[step.id] || 'Not Started') === 'Done').length;

  const isCellActive = (step, day) => {
    const key = dateKey(day);
    return key >= dateKey(step.startDate) && key <= dateKey(step.endDate);
  };

  const updateStatus = (stepId, status) => {
    setStatuses((current) => ({
      ...current,
      [stepId]: status,
    }));
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Production Calendar</h1>
            <p className="mt-2 text-slate-600">
              Track posted jobs through flexible production steps, dependencies, and planned calendar dates.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={loadJobs} className="gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[330px_1fr]">
          <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
            <div>
              <label className="text-sm font-semibold">Production Job</label>
              <select
                value={selectedJob?.id || ''}
                onChange={(event) => setSelectedJobId(event.target.value)}
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
                <div className="text-xs text-slate-500">Steps</div>
                <div className="text-2xl font-black">{workflowSteps.length}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Total Time</div>
                <div className="text-2xl font-black">{formatHours(totalMinutes)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Production</div>
                <div className="text-xl font-black text-orange-600">{formatHours(productionMinutes)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Installation</div>
                <div className="text-xl font-black text-green-600">{formatHours(installMinutes)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Active</div>
                <div className="text-xl font-black text-blue-600">{activeCount}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Complete</div>
                <div className="text-xl font-black text-emerald-600">{completeCount}</div>
              </div>
            </div>

            <div className="rounded-xl border p-3 text-xs text-slate-500">
              This view creates a planned calendar from the posted job. In the next step, we can save step dates,
              owners, notes, and statuses to the backend.
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <CalendarDays size={18} />
                  Calendar Board
                </h2>
                <p className="text-sm text-slate-500">
                  Some early steps can run together. Production steps are sequenced until custom rules are added.
                </p>
              </div>

              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Start Date</label>
                  <Input
                    type="date"
                    value={calendarStart}
                    onChange={(event) => setCalendarStart(event.target.value)}
                    className="w-full md:w-40"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500">Days</label>
                  <select
                    value={daysToShow}
                    onChange={(event) => setDaysToShow(Number(event.target.value))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:w-28"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={21}>21 days</option>
                    <option value={30}>30 days</option>
                  </select>
                </div>

                <div className="relative">
                  <label className="text-xs font-semibold text-slate-500">Search</label>
                  <Search size={16} className="absolute left-3 top-8 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search steps"
                    className="pl-9 md:w-64"
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading production jobs...</div>
            ) : !selectedJob ? (
              <div className="p-12 text-center text-slate-500">No jobs have been posted to production yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="min-w-[1200px]"
                  style={{
                    width: `${430 + calendarDays.length * 120}px`,
                  }}
                >
                  <div
                    className="grid border-b bg-white text-xs font-black uppercase tracking-wide text-slate-500"
                    style={{
                      gridTemplateColumns: `280px 150px ${calendarDays.map(() => '120px').join(' ')}`,
                    }}
                  >
                    <div className="border-r px-4 py-3">Step</div>
                    <div className="border-r px-4 py-3 text-center">Status</div>
                    {calendarDays.map((day) => (
                      <div key={dateKey(day)} className="border-r px-3 py-3 text-center">
                        {formatDayLabel(day)}
                      </div>
                    ))}
                  </div>

                  {Object.entries(groupedSteps).map(([group, steps]) => (
                    <div key={group} className="border-l-4 border-blue-500">
                      <div className="border-b bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                        {group}
                      </div>

                      {steps.map((step) => {
                        const status = statuses[step.id] || 'Not Started';

                        return (
                          <div
                            key={step.id}
                            className="grid border-b text-sm hover:bg-slate-50"
                            style={{
                              gridTemplateColumns: `280px 150px ${calendarDays.map(() => '120px').join(' ')}`,
                            }}
                          >
                            <div className="border-r bg-white px-4 py-3">
                              <div className="flex items-center gap-2 font-bold text-slate-900">
                                {getIcon(step.department)}
                                {step.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">{step.owner}</div>
                              <div className="mt-1 text-[11px] text-slate-400">{step.source}</div>
                              {step.dependsOn?.length ? (
                                <div className="mt-1 text-[11px] font-semibold text-purple-600">
                                  Waits for: {step.dependsOn.join(', ')}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center border-r bg-white px-3">
                              <select
                                value={status}
                                onChange={(event) => updateStatus(step.id, event.target.value)}
                                className={`w-full rounded-full border px-2 py-1 text-xs font-bold ${statusClasses[status] || statusClasses['Not Started']}`}
                              >
                                {statusOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {calendarDays.map((day) => {
                              const active = isCellActive(step, day);
                              const colour = departmentClasses[step.department] || 'bg-slate-500';

                              return (
                                <div key={dateKey(day)} className="flex min-h-[72px] items-center border-r bg-slate-50 px-2">
                                  {active ? (
                                    <div className={`w-full rounded-lg ${colour} px-2 py-2 text-center text-[11px] font-bold text-white shadow-sm`}>
                                      {formatHours(step.plannedMinutes)}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {filteredSteps.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      No matching production steps found.
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
