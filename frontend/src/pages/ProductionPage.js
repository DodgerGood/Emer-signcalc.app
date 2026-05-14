import React, { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  CalendarDays,
  Download,
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

const DAYS_BACK = 7;
const DAYS_FORWARD = 14;
const TOTAL_DAYS = DAYS_BACK + 1 + DAYS_FORWARD;

const jobColourClasses = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-pink-500',
];

const statusClasses = {
  QUEUED: 'bg-slate-100 text-slate-700 border-slate-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
  DONE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function clean(value, fallback) {
  return String(value || '').trim() || fallback;
}

function startOfDay(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function formatShortDate(date) {
  return date.toLocaleDateString('en-ZA', {
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

function getStepIcon(department) {
  if (department === 'DESIGN') return <FileCheck size={14} />;
  if (department === 'PROCUREMENT') return <PackageCheck size={14} />;
  if (department === 'STOCK') return <PackageCheck size={14} />;
  if (department === 'MACHINE') return <Factory size={14} />;
  if (department === 'LABOUR') return <Users size={14} />;
  if (department === 'INSTALLATION') return <Wrench size={14} />;
  if (department === 'DISPATCH') return <Truck size={14} />;
  return <ClipboardList size={14} />;
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
      source: 'Check bought-in items and supplier requirements.',
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
      plannedMinutes: 45,
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

function downloadBlob(response, filename) {
  const blob = new Blob([response.data], {
    type: response.headers?.['content-type'] || 'application/octet-stream',
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export default function ProductionPage() {
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => startOfDay(new Date()), []);
  const calendarStart = useMemo(() => addDays(today, -DAYS_BACK), [today]);

  const calendarDays = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, index) => addDays(calendarStart, index));
  }, [calendarStart]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/production');
      setJobs(response.data || []);
    } catch {
      toast.error('Failed to load production jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const filteredJobs = jobs.filter((job) => {
    const term = search.toLowerCase();

    return (
      job.client_name?.toLowerCase().includes(term) ||
      job.invoice_number?.toLowerCase().includes(term) ||
      job.quote_number?.toLowerCase().includes(term) ||
      job.estimate_number?.toLowerCase().includes(term) ||
      job.job_ticket_document_filename?.toLowerCase().includes(term) ||
      job.design_proof_filename?.toLowerCase().includes(term)
    );
  });

  const scheduledJobs = filteredJobs.map((job, index) => {
    const jobStart = startOfDay(job.production_posted_at || job.invoice_created_at || job.created_at || today);
    const steps = buildWorkflow(job);
    const scheduledSteps = scheduleWorkflow(steps, jobStart);
    const totalMinutes = steps.reduce((sum, step) => sum + Number(step.plannedMinutes || 0), 0);
    const jobColour = jobColourClasses[index % jobColourClasses.length];

    return {
      job,
      steps,
      scheduledSteps,
      totalMinutes,
      jobColour,
      startDate: scheduledSteps[0]?.startDate || jobStart,
      endDate: scheduledSteps[scheduledSteps.length - 1]?.endDate || jobStart,
    };
  });

  const downloadJobPack = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/job-ticket`, {
        responseType: 'blob',
      });

      const filename = job.job_ticket_document_filename || `${job.invoice_number || 'job'}-job-ticket`;
      downloadBlob(response, filename);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No job pack / job ticket uploaded yet');
    }
  };

  const totalJobs = scheduledJobs.length;
  const totalSteps = scheduledJobs.reduce((sum, item) => sum + item.steps.length, 0);
  const totalMinutes = scheduledJobs.reduce((sum, item) => sum + item.totalMinutes, 0);

  const todayIndex = calendarDays.findIndex((day) => dateKey(day) === dateKey(today));

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Production Calendar</h1>
            <p className="mt-2 text-slate-600">
              View all posted production jobs on one calendar, with each job assigned its own colour.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={loadJobs} className="gap-2">
            <RefreshCw size={16} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[330px_1fr]">
          <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-black text-slate-900">Calendar Window</div>
              <div>From: {formatShortDate(calendarDays[0])}</div>
              <div>Today: {formatShortDate(today)}</div>
              <div>To: {formatShortDate(calendarDays[calendarDays.length - 1])}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Jobs</div>
                <div className="text-2xl font-black">{totalJobs}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Steps</div>
                <div className="text-2xl font-black">{totalSteps}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Total Time</div>
                <div className="text-xl font-black text-blue-600">{formatHours(totalMinutes)}</div>
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-xs text-slate-500">Range</div>
                <div className="text-xl font-black text-purple-600">-1w / +2w</div>
              </div>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search job, client, invoice, job pack"
                className="pl-9"
              />
            </div>

            <div className="rounded-xl border p-3 text-xs text-slate-500">
              Search for a job, then use the download button in that job row to download its uploaded Job Pack / Job Ticket.
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <CalendarDays size={18} />
                  Multi-Job Calendar Board
                </h2>
                <p className="text-sm text-slate-500">
                  Red line marks today. Calendar shows one week before today and two weeks forward.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-500">Loading production jobs...</div>
            ) : scheduledJobs.length === 0 ? (
              <div className="p-12 text-center text-slate-500">No posted production jobs found.</div>
            ) : (
              <div className="overflow-x-auto">
                <div
                  className="relative min-w-[1300px]"
                  style={{
                    width: `${360 + calendarDays.length * 105}px`,
                  }}
                >
                  <div
                    className="sticky top-0 z-20 grid border-b bg-white text-xs font-black uppercase tracking-wide text-slate-500"
                    style={{
                      gridTemplateColumns: `360px ${calendarDays.map(() => '105px').join(' ')}`,
                    }}
                  >
                    <div className="border-r px-4 py-3">Job</div>

                    {calendarDays.map((day) => {
                      const isToday = dateKey(day) === dateKey(today);

                      return (
                        <div
                          key={dateKey(day)}
                          className={`relative border-r px-2 py-3 text-center ${isToday ? 'bg-red-50 text-red-700' : ''}`}
                        >
                          {isToday ? (
                            <div className="absolute left-0 top-0 h-full w-[3px] bg-red-600" />
                          ) : null}
                          {formatDayLabel(day)}
                          {isToday ? (
                            <div className="mt-1 text-[10px] font-black text-red-600">TODAY</div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {scheduledJobs.map(({ job, scheduledSteps, totalMinutes: jobMinutes, jobColour }, jobIndex) => (
                    <div
                      key={job.id}
                      className="grid border-b text-sm hover:bg-slate-50"
                      style={{
                        gridTemplateColumns: `360px ${calendarDays.map(() => '105px').join(' ')}`,
                      }}
                    >
                      <div className="border-r bg-white px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-4 w-4 rounded-full ${jobColour}`} />

                          <div className="min-w-0 flex-1">
                            <div className="truncate font-black text-slate-900">
                              {job.invoice_number || job.quote_number || 'Job'} - {job.client_name}
                            </div>

                            <div className="mt-1 text-xs text-slate-500">
                              {scheduledSteps.length} steps • {formatHours(jobMinutes)}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClasses[job.production_status || 'QUEUED'] || statusClasses.QUEUED}`}>
                                {job.production_status || 'QUEUED'}
                              </span>

                              {job.job_ticket_document_filename ? (
                                <span className="max-w-[160px] truncate rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                  {job.job_ticket_document_filename}
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                                  No job pack
                                </span>
                              )}
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => downloadJobPack(job)}
                              className="mt-3 h-8 gap-2 text-xs"
                            >
                              <Download size={14} />
                              Download Job Pack
                            </Button>
                          </div>
                        </div>
                      </div>

                      {calendarDays.map((day) => {
                        const isToday = dateKey(day) === dateKey(today);
                        const stepsForDay = scheduledSteps.filter((step) => (
                          dateKey(day) >= dateKey(step.startDate) && dateKey(day) <= dateKey(step.endDate)
                        ));

                        return (
                          <div
                            key={`${job.id}-${dateKey(day)}`}
                            className={`relative min-h-[132px] border-r bg-slate-50 p-2 ${isToday ? 'bg-red-50/40' : ''}`}
                          >
                            {isToday ? (
                              <div className="absolute left-0 top-0 z-10 h-full w-[3px] bg-red-600" />
                            ) : null}

                            <div className="space-y-1">
                              {stepsForDay.slice(0, 4).map((step) => (
                                <div
                                  key={step.id}
                                  className={`rounded-md ${jobColour} px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm`}
                                  title={`${step.name} - ${formatHours(step.plannedMinutes)}`}
                                >
                                  <div className="flex items-center gap-1">
                                    {getStepIcon(step.department)}
                                    <span className="truncate">{step.name}</span>
                                  </div>
                                  <div className="text-[9px] opacity-90">{formatHours(step.plannedMinutes)}</div>
                                </div>
                              ))}

                              {stepsForDay.length > 4 ? (
                                <div className="rounded-md bg-slate-700 px-2 py-1 text-center text-[10px] font-bold text-white">
                                  +{stepsForDay.length - 4} more
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {todayIndex >= 0 ? (
                    <div
                      className="pointer-events-none absolute top-0 z-30 h-full w-[3px] bg-red-600"
                      style={{
                        left: `${360 + todayIndex * 105}px`,
                      }}
                    />
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
