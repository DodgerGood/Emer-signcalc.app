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

const CALENDAR_DAYS = 21;

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

const departmentOptions = [
  { value: 'ALL', label: 'All Departments' },
  { value: 'ADMIN', label: 'Admin / Job Pack' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'PROCUREMENT', label: 'Procurement' },
  { value: 'STOCK', label: 'Stock' },
  { value: 'MACHINE', label: 'Machines' },
  { value: 'MACHINE_HIRE', label: 'Machine Hire' },
  { value: 'LABOUR', label: 'Labour' },
  { value: 'QC', label: 'QC' },
  { value: 'PACKING', label: 'Packing' },
  { value: 'DISPATCH', label: 'Dispatch' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'CLOSE', label: 'Close Job' },
];

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

function getMonday(date) {
  const copy = startOfDay(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(copy, diff);
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

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
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
  if (department === 'MACHINE' || department === 'MACHINE_HIRE') return <Factory size={14} />;
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

function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }

  return 0;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }

  return '';
}

function calculateLineSqm(line) {
  const width = Number(line.width_mm || line.width || 0);
  const height = Number(line.height_mm || line.height || 0);
  const qty = Number(line.quantity || line.qty || 1);

  if (!width || !height) return 0;

  return (width * height * qty) / 1000000;
}

function calculateResourceMinutes(entry, line, quoteQty) {
  const lineSqm = calculateLineSqm(line);
  const qty = Number(quoteQty || line.quantity || line.qty || 1);

  const directHours = firstNumber(
    entry.total_hours,
    entry.hours_total,
    entry.calculated_hours,
    entry.production_hours,
    entry.install_hours,
    entry.labour_hours,
    entry.labor_hours,
    entry.machine_hours,
    entry.hours
  );

  if (directHours) return directHours * 60;

  const hoursPerSqm = firstNumber(
    entry.hours_per_sqm,
    entry.labour_hours_per_sqm,
    entry.labor_hours_per_sqm,
    entry.machine_hours_per_sqm,
    entry.install_hours_per_sqm
  );

  if (hoursPerSqm && lineSqm) return hoursPerSqm * lineSqm * 60;

  const minutesPerSqm = firstNumber(
    entry.minutes_per_sqm,
    entry.labour_minutes_per_sqm,
    entry.machine_minutes_per_sqm,
    entry.install_minutes_per_sqm
  );

  if (minutesPerSqm && lineSqm) return minutesPerSqm * lineSqm;

  const hoursPerUnit = firstNumber(
    entry.hours_per_unit,
    entry.labour_hours_per_unit,
    entry.machine_hours_per_unit,
    entry.install_hours_per_unit
  );

  if (hoursPerUnit) return hoursPerUnit * qty * 60;

  const minutesPerUnit = firstNumber(
    entry.minutes_per_unit,
    entry.labour_minutes_per_unit,
    entry.machine_minutes_per_unit,
    entry.install_minutes_per_unit
  );

  if (minutesPerUnit) return minutesPerUnit * qty;

  const ratePerHour = firstNumber(
    entry.rate_per_hour,
    entry.hourly_rate,
    entry.machine_rate_per_hour,
    entry.labour_rate_per_hour,
    entry.labor_rate_per_hour,
    entry.install_rate_per_hour
  );

  const totalCost = firstNumber(
    entry.total_cost,
    entry.cost,
    entry.line_cost,
    entry.calculated_cost
  );

  if (ratePerHour && totalCost) return (totalCost / ratePerHour) * 60;

  return 0;
}

function normalizeResourceType(entry) {
  const rawType = String(
    entry.line_type ||
    entry.type ||
    entry.resource_type ||
    entry.category ||
    entry.section ||
    ''
  ).toUpperCase();

  const nameText = String(
    entry.name ||
    entry.custom_name ||
    entry.reference_name ||
    entry.machine_name ||
    entry.labour_type_name ||
    entry.labor_type_name ||
    entry.install_type_name ||
    ''
  ).toUpperCase();

  const combined = `${rawType} ${nameText}`;

  if (combined.includes('MACHINE HIRE') || combined.includes('HIRE MACHINE') || combined.includes('HIRED MACHINE')) {
    return 'MACHINE_HIRE';
  }

  if (combined.includes('MACHINE')) return 'MACHINE';
  if (combined.includes('LABOUR') || combined.includes('LABOR')) return 'LABOUR';
  if (combined.includes('INSTALL')) return 'INSTALLATION';
  if (combined.includes('DELIVERY') || combined.includes('DISPATCH')) return 'DISPATCH';
  if (combined.includes('QC') || combined.includes('QUALITY')) return 'QC';
  if (combined.includes('PACK')) return 'PACKING';

  return '';
}

function extractBlueprintEntries(line) {
  return (
    line.recipe_breakdown ||
    line.breakdown ||
    line.line_items ||
    line.items ||
    line.components ||
    []
  );
}

function makeResourceStep({ line, entry, index, entryIndex, fallbackType }) {
  const quoteQty = Number(line.quantity || line.qty || 1);
  const item = clean(
    line.item_name || line.product_name || line.recipe_name || line.name || line.description,
    `Item ${index + 1}`
  );

  const width = line.width_mm || line.width || '-';
  const height = line.height_mm || line.height || '-';
  const size = `${width} x ${height} mm`;

  const department = fallbackType || normalizeResourceType(entry);
  if (!department) return null;

  const resource = clean(
    firstText(
      entry.name,
      entry.custom_name,
      entry.reference_name,
      entry.resource_name,
      entry.machine_name,
      entry.machine_type_name,
      entry.labour_type_name,
      entry.labor_type_name,
      entry.install_type_name,
      entry.supplier
    ),
    department.replace('_', ' ')
  );

  const resourceMinutes = calculateResourceMinutes(entry, line, quoteQty);

  const setupMinutes = ['MACHINE', 'MACHINE_HIRE', 'INSTALLATION'].includes(department)
    ? firstNumber(entry.setup_minutes, entry.setup_time_minutes, SETUP_MINUTES)
    : 0;

  const removalMinutes = ['MACHINE', 'MACHINE_HIRE', 'INSTALLATION'].includes(department)
    ? firstNumber(entry.removal_minutes, entry.cleanup_minutes, entry.strike_minutes, REMOVAL_MINUTES)
    : 0;

  const plannedMinutes = Math.max(
    15,
    resourceMinutes + setupMinutes + removalMinutes
  );

  const group = department === 'INSTALLATION' || department === 'DISPATCH'
    ? 'Handover'
    : 'Production';

  const qtyText = Number.isFinite(quoteQty) ? String(quoteQty).replace(/\.0$/, '') : '1';

  return makeStep({
    id: `${department.toLowerCase()}-${index}-${entryIndex}`,
    group,
    name: `${resource} - ${item}`,
    department,
    owner: resource,
    plannedMinutes,
    source: `${qtyText} x ${size}. Work: ${formatHours(resourceMinutes)}${setupMinutes ? `, setup: ${setupMinutes}min` : ''}${removalMinutes ? `, removal: ${removalMinutes}min` : ''}.`,
  });
}

function extractProductionSteps(job) {
  const steps = [];
  const blueprint = job?.blueprint || {};
  const estimateLines = blueprint.estimate_lines || [];
  const quoteLines = job?.lines || [];
  const labourItems = job?.labour_items || [];
  const installationItems = job?.installation_items || [];

  estimateLines.forEach((line, index) => {
    const entries = extractBlueprintEntries(line);

    entries.forEach((entry, entryIndex) => {
      const step = makeResourceStep({
        line,
        entry,
        index,
        entryIndex,
      });

      if (step) steps.push(step);
    });

    const item = clean(
      line.item_name || line.product_name || line.recipe_name || line.name || line.description,
      `Item ${index + 1}`
    );

    const fulfilmentType = String(line.fulfilment_type || '').toUpperCase();

    if (fulfilmentType === 'SITE_INSTALL') {
      const installMinutes = firstNumber(
        line.install_minutes,
        line.fulfilment_minutes,
        Number(line.install_hours || line.fulfilment_hours || 0) * 60
      );

      steps.push(makeStep({
        id: `fulfilment-install-${index}`,
        group: 'Handover',
        name: `Installation - ${item}`,
        department: 'INSTALLATION',
        owner: 'Installation Team',
        plannedMinutes: Math.max(15, installMinutes + SETUP_MINUTES + REMOVAL_MINUTES),
        source: line.fulfilment_note || `Install ${item}`,
      }));
    }

    if (fulfilmentType === 'DELIVERY') {
      const deliveryMinutes = firstNumber(
        line.delivery_minutes,
        line.fulfilment_minutes,
        Number(line.delivery_hours || line.fulfilment_hours || 0) * 60,
        45
      );

      steps.push(makeStep({
        id: `fulfilment-delivery-${index}`,
        group: 'Handover',
        name: `Delivery - ${item}`,
        department: 'DISPATCH',
        owner: 'Dispatch',
        plannedMinutes: deliveryMinutes,
        source: line.fulfilment_note || `Deliver ${item}`,
      }));
    }
  });

  quoteLines.forEach((line, lineIndex) => {
    (line.line_items || []).forEach((entry, entryIndex) => {
      const step = makeResourceStep({
        line,
        entry,
        index: `quote-${lineIndex}`,
        entryIndex,
      });

      if (step) steps.push(step);
    });
  });

  labourItems.forEach((item, index) => {
    const minutes = Number(item.hours || 0) * 60;

    steps.push(makeStep({
      id: `manual-labour-${index}`,
      group: 'Production',
      name: clean(item.labour_type_name, 'Labour'),
      department: 'LABOUR',
      owner: clean(item.labour_type_name, 'Labour'),
      plannedMinutes: Math.max(15, minutes),
      source: item.notes || 'Manual labour item',
    }));
  });

  installationItems.forEach((item, index) => {
    const minutes = Number(item.hours || 0) * 60;

    steps.push(makeStep({
      id: `manual-install-${index}`,
      group: 'Handover',
      name: clean(item.install_type_name, 'Installation'),
      department: 'INSTALLATION',
      owner: clean(item.install_type_name, 'Installation'),
      plannedMinutes: Math.max(15, minutes + SETUP_MINUTES + REMOVAL_MINUTES),
      source: item.notes || 'Manual installation item',
    }));
  });

  const unique = [];
  const seen = new Set();

  steps.forEach((step) => {
    const key = `${step.department}-${step.owner}-${step.name}-${step.source}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(step);
    }
  });

  return unique;
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

function CalendarHeader({ calendarDays, today }) {
  return (
    <>
      {calendarDays.map((day) => {
        const isToday = dateKey(day) === dateKey(today);
        const weekend = isWeekend(day);

        return (
          <div
            key={dateKey(day)}
            className={`relative border-r px-2 py-3 text-center ${
              isToday
                ? 'bg-red-50 text-red-700'
                : weekend
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-white'
            }`}
          >
            {formatDayLabel(day)}

            {isToday ? (
              <div className="mt-1 text-[10px] font-black text-red-600">TODAY</div>
            ) : weekend ? (
              <div className="mt-1 text-[10px] font-semibold text-slate-400">WEEKEND</div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function TodayLine({ calendarDays, today, leftWidth, dayWidth }) {
  const todayIndex = calendarDays.findIndex((day) => dateKey(day) === dateKey(today));

  if (todayIndex < 0) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 z-30 h-full w-[3px] bg-red-600"
      style={{
        left: `${leftWidth + todayIndex * dayWidth}px`,
      }}
    />
  );
}

export default function ProductionPage() {
  const [jobs, setJobs] = useState([]);
  const [jobSearch, setJobSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('MACHINE');
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => startOfDay(new Date()), []);

  const calendarDays = useMemo(() => {
    return Array.from({ length: CALENDAR_DAYS }, (_, index) => addDays(today, index));
  }, [today]);

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

  const allScheduledJobs = jobs.map((job, index) => {
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

  const jobOverviewRows = allScheduledJobs.filter(({ job }) => {
    const term = jobSearch.toLowerCase();

    return (
      job.client_name?.toLowerCase().includes(term) ||
      job.invoice_number?.toLowerCase().includes(term) ||
      job.quote_number?.toLowerCase().includes(term) ||
      job.estimate_number?.toLowerCase().includes(term) ||
      job.job_ticket_document_filename?.toLowerCase().includes(term) ||
      job.design_proof_filename?.toLowerCase().includes(term)
    );
  });

  const resourceRows = useMemo(() => {
    const rows = {};

    allScheduledJobs.forEach(({ job, scheduledSteps, jobColour }) => {
      scheduledSteps.forEach((step) => {
        if (departmentFilter !== 'ALL' && step.department !== departmentFilter) return;

        const rowKey = `${step.department}-${step.owner}`;

        if (!rows[rowKey]) {
          rows[rowKey] = {
            id: rowKey,
            department: step.department,
            owner: step.owner,
            events: [],
          };
        }

        rows[rowKey].events.push({
          id: `${job.id}-${step.id}`,
          job,
          step,
          jobColour,
        });
      });
    });

    return Object.values(rows).sort((a, b) => {
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      return a.owner.localeCompare(b.owner);
    });
  }, [allScheduledJobs, departmentFilter]);

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

  const totalJobs = allScheduledJobs.length;
  const totalSteps = allScheduledJobs.reduce((sum, item) => sum + item.steps.length, 0);
  const totalMinutes = allScheduledJobs.reduce((sum, item) => sum + item.totalMinutes, 0);

  return (
    <Layout>
      <div className="space-y-6 fade-in max-w-7xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight leading-none">Production Calendar</h1>
            <p className="mt-2 text-slate-600">
              Track posted production jobs by job overview and by department/resource capacity.
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
              <div>Starts: {formatShortDate(today)}</div>
              <div>View: scroll left / right</div>
              <div>Weekends are greyed out</div>
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
                <div className="text-xs text-slate-500">Visible</div>
                <div className="text-xl font-black text-purple-600">Scroll</div>
              </div>
            </div>

            <div className="rounded-xl border p-3 text-xs text-slate-500">
              The Job Overview search only filters the first calendar. The Department Calendar below uses its own department filter.
            </div>
          </div>

          <div className="space-y-6">
            {/* JOB OVERVIEW CALENDAR */}
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black">
                    <CalendarDays size={18} />
                    Job Overview Calendar
                  </h2>
                  <p className="text-sm text-slate-500">
                    One row per posted job. Use the week controls to move left or right.
                  </p>
                </div>


              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-500">Loading production jobs...</div>
              ) : jobOverviewRows.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No posted production jobs found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="relative min-w-[1300px]"
                    style={{
                      width: `${360 + calendarDays.length * 160}px`,
                    }}
                  >
                    <div
                      className="sticky top-0 z-20 grid border-b bg-white text-xs font-black uppercase tracking-wide text-slate-500"
                      style={{
                        gridTemplateColumns: `360px ${calendarDays.map(() => '160px').join(' ')}`,
                      }}
                    >
                      <div className="sticky left-0 z-30 border-r bg-white px-4 py-3">
                        <div className="mb-2">Job</div>
                        <div className="relative">
                          <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                          <Input
                            value={jobSearch}
                            onChange={(event) => setJobSearch(event.target.value)}
                            placeholder="Search jobs"
                            className="h-8 pl-8 text-xs normal-case tracking-normal"
                          />
                        </div>
                      </div>
                      <CalendarHeader calendarDays={calendarDays} today={today} />
                    </div>

                    {jobOverviewRows.map(({ job, scheduledSteps, totalMinutes: jobMinutes, jobColour }) => (
                      <div
                        key={job.id}
                        className="grid border-b text-sm hover:bg-slate-50"
                        style={{
                          gridTemplateColumns: `360px ${calendarDays.map(() => '160px').join(' ')}`,
                        }}
                      >
                        <div className="sticky left-0 z-20 border-r bg-white px-4 py-4">
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
                              className={`relative min-h-[132px] border-r p-2 ${
                                isToday ? 'bg-red-50/40' : isWeekend(day) ? 'bg-slate-100' : 'bg-slate-50'
                              }`}
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

                    <div
                      className="pointer-events-none absolute top-0 z-30 h-full w-[3px] bg-red-600"
                      style={{ left: '360px' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* DEPARTMENT / MACHINE CALENDAR */}
            <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-black">
                    <Factory size={18} />
                    Department / Machine Calendar
                  </h2>
                  <p className="text-sm text-slate-500">
                    Rows show departments/resources so you can see when machines, labour, installation and dispatch are busy.
                  </p>
                </div>

                <div className="w-full md:w-72">
                  <select
                    value={departmentFilter}
                    onChange={(event) => setDepartmentFilter(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {departmentOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-slate-500">Loading department calendar...</div>
              ) : resourceRows.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No scheduled resources found for this department filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="relative min-w-[1300px]"
                    style={{
                      width: `${300 + calendarDays.length * 160}px`,
                    }}
                  >
                    <div
                      className="sticky top-0 z-20 grid border-b bg-white text-xs font-black uppercase tracking-wide text-slate-500"
                      style={{
                        gridTemplateColumns: `300px ${calendarDays.map(() => '160px').join(' ')}`,
                      }}
                    >
                      <div className="sticky left-0 z-30 border-r bg-white px-4 py-3">Department / Resource</div>
                      <CalendarHeader calendarDays={calendarDays} today={today} />
                    </div>

                    {resourceRows.map((row) => (
                      <div
                        key={row.id}
                        className="grid border-b text-sm hover:bg-slate-50"
                        style={{
                          gridTemplateColumns: `300px ${calendarDays.map(() => '160px').join(' ')}`,
                        }}
                      >
                        <div className="sticky left-0 z-20 border-r bg-white px-4 py-4">
                          <div className="flex items-center gap-2 font-black text-slate-900">
                            {getStepIcon(row.department)}
                            {row.owner}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {departmentOptions.find((option) => option.value === row.department)?.label || row.department}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {row.events.length} scheduled task{row.events.length === 1 ? '' : 's'}
                          </div>
                        </div>

                        {calendarDays.map((day) => {
                          const isToday = dateKey(day) === dateKey(today);
                          const eventsForDay = row.events.filter(({ step }) => (
                            dateKey(day) >= dateKey(step.startDate) && dateKey(day) <= dateKey(step.endDate)
                          ));

                          return (
                            <div
                              key={`${row.id}-${dateKey(day)}`}
                              className={`relative min-h-[118px] border-r p-2 ${
                                isToday ? 'bg-red-50/40' : isWeekend(day) ? 'bg-slate-100' : 'bg-slate-50'
                              }`}
                            >
                              {isToday ? (
                                <div className="absolute left-0 top-0 z-10 h-full w-[3px] bg-red-600" />
                              ) : null}

                              <div className="space-y-1">
                                {eventsForDay.slice(0, 4).map(({ id, job, step, jobColour }) => (
                                  <div
                                    key={id}
                                    className={`rounded-md ${jobColour} px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm`}
                                    title={`${job.invoice_number || 'Job'} - ${job.client_name}: ${step.name}`}
                                  >
                                    <div className="truncate">{job.invoice_number || 'Job'}</div>
                                    <div className="truncate text-[9px] opacity-90">{step.name}</div>
                                    <div className="text-[9px] opacity-90">{formatHours(step.plannedMinutes)}</div>
                                  </div>
                                ))}

                                {eventsForDay.length > 4 ? (
                                  <div className="rounded-md bg-slate-700 px-2 py-1 text-center text-[10px] font-bold text-white">
                                    +{eventsForDay.length - 4} more
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}

                    <div
                      className="pointer-events-none absolute top-0 z-30 h-full w-[3px] bg-red-600"
                      style={{ left: '300px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
