import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import {
  CalendarDays,
  ClipboardList,
  Download,
  Factory,
  FileCheck,
  FileText,
  Hammer,
  Package,
  PackageCheck,
  Search,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

const SLOT_WIDTH = 28;
const WEEKEND_DAY_WIDTH = 120;
const SLOT_MINUTES = 15;
const JOB_COLUMN_WIDTH = 320;
const RESOURCE_COLUMN_WIDTH = 280;
const DAYS_BACK = 7;
const DAYS_FORWARD = 14;
const CALENDAR_DAYS = DAYS_BACK + 1 + DAYS_FORWARD;

const defaultCompanyDetails = {
  production_work_start: '08:00',
  production_work_end: '17:00',
  production_tea_1_start: '10:00',
  production_tea_1_end: '10:15',
  production_lunch_start: '13:00',
  production_lunch_end: '13:30',
  production_tea_2_start: '15:00',
  production_tea_2_end: '15:15',
};

const SETUP_MINUTES = 15;
const REMOVAL_MINUTES = 15;

const jobColours = [
  {
    dot: 'bg-blue-500',
    card: 'bg-blue-500',
    soft: 'bg-blue-50',
    text: 'text-blue-700',
  },
  {
    dot: 'bg-emerald-500',
    card: 'bg-emerald-500',
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  {
    dot: 'bg-purple-500',
    card: 'bg-purple-500',
    soft: 'bg-purple-50',
    text: 'text-purple-700',
  },
  {
    dot: 'bg-orange-500',
    card: 'bg-orange-500',
    soft: 'bg-orange-50',
    text: 'text-orange-700',
  },
  {
    dot: 'bg-cyan-500',
    card: 'bg-cyan-500',
    soft: 'bg-cyan-50',
    text: 'text-cyan-700',
  },
  {
    dot: 'bg-rose-500',
    card: 'bg-rose-500',
    soft: 'bg-rose-50',
    text: 'text-rose-700',
  },
];

const statusClasses = {
  QUEUED: 'bg-slate-100 text-slate-700 border-slate-200',
  ACTIVE: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  WAITING: 'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const baseWorkflow = [
  { name: 'Job Pack', department: 'ADMIN', minutes: 30, dayOffset: 0 },
  { name: 'Design', department: 'DESIGN', minutes: 60, dayOffset: 1 },
  { name: 'Procurement', department: 'PROCUREMENT', minutes: 60, dayOffset: 1 },
  { name: 'Production Brief', department: 'ADMIN', minutes: 30, dayOffset: 1 },
  { name: 'Stock Issuing', department: 'STOCK', minutes: 30, dayOffset: 2 },
  { name: 'QC', department: 'QC', minutes: 30, dayOffset: 3 },
  { name: 'Packing', department: 'PACKING', minutes: 30, dayOffset: 4 },
  { name: 'Dispatch', department: 'DISPATCH', minutes: 45, dayOffset: 5 },
  { name: 'Delivery Note Signed', department: 'DISPATCH', minutes: 15, dayOffset: 6 },
  { name: 'Close Job', department: 'ADMIN', minutes: 15, dayOffset: 6 },
];

const departmentOptions = [
  'ALL',
  'ADMIN',
  'DESIGN',
  'PROCUREMENT',
  'STOCK',
  'MACHINE',
  'LABOUR',
  'INSTALLATION',
  'MACHINE HIRE',
  'QC',
  'PACKING',
  'DISPATCH',
];

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
  return copy;
}

function addWorkdays(date, workdays) {
  let copy = startOfDay(date);
  let added = 0;

  if (workdays <= 0) {
    while (isWeekend(copy)) {
      copy = addDays(copy, 1);
    }

    return copy;
  }

  while (added < workdays) {
    copy = addDays(copy, 1);

    if (!isWeekend(copy)) {
      added += 1;
    }
  }

  return copy;
}

function dateKey(date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function isWeekend(date) {
  const day = startOfDay(date).getDay();
  return day === 0 || day === 6;
}

function formatDayHeader(date, today) {
  const dayName = date.toLocaleDateString('en-ZA', { weekday: 'short' }).toUpperCase();
  const dayNumber = date.toLocaleDateString('en-ZA', { day: '2-digit' });
  const month = date.toLocaleDateString('en-ZA', { month: 'short' }).toUpperCase();
  const isToday = dateKey(date) === dateKey(today);

  return {
    top: `${dayName}, ${dayNumber} ${month}`,
    bottom: isToday ? 'TODAY' : isWeekend(date) ? 'WEEKEND' : '',
    isToday,
    weekend: isWeekend(date),
  };
}

function formatHours(minutes) {
  const value = Number(minutes || 0);

  if (value < 60) {
    return `${Math.round(value)}min`;
  }

  const hours = value / 60;
  return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(2)}h`;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function timeToMinutes(value) {
  if (!value || !String(value).includes(':')) return null;

  const [hours, minutes] = String(value).split(':').map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const safeValue = Math.max(0, Number(value) || 0);
  const hours = Math.floor(safeValue / 60);
  const minutes = safeValue % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function buildTimeSlots(companyDetails) {
  const details = {
    ...defaultCompanyDetails,
    ...(companyDetails || {}),
  };

  const workStart = timeToMinutes(details.production_work_start) ?? 8 * 60;
  const workEnd = timeToMinutes(details.production_work_end) ?? 17 * 60;

  if (workEnd <= workStart) {
    return [];
  }

  const breakRanges = [
    {
      label: 'Tea 1',
      start: timeToMinutes(details.production_tea_1_start),
      end: timeToMinutes(details.production_tea_1_end),
    },
    {
      label: 'Lunch',
      start: timeToMinutes(details.production_lunch_start),
      end: timeToMinutes(details.production_lunch_end),
    },
    {
      label: 'Tea 2',
      start: timeToMinutes(details.production_tea_2_start),
      end: timeToMinutes(details.production_tea_2_end),
    },
  ].filter((item) => item.start !== null && item.end !== null && item.end > item.start);

  const slots = [];

  for (let start = workStart; start < workEnd; start += SLOT_MINUTES) {
    const end = Math.min(start + SLOT_MINUTES, workEnd);
    const blockedBreak = breakRanges.find((item) => rangesOverlap(start, end, item.start, item.end));

    slots.push({
      key: `${minutesToTime(start)}-${minutesToTime(end)}`,
      label: minutesToTime(start),
      start,
      end,
      isHour: start % 60 === 0,
      isBreak: Boolean(blockedBreak),
      breakLabel: blockedBreak?.label || '',
    });
  }

  return slots;
}

function getDayWidth(day, timeSlots) {
  return isWeekend(day) ? WEEKEND_DAY_WIDTH : Math.max(SLOT_WIDTH, timeSlots.length * SLOT_WIDTH);
}

function getCalendarWidth(calendarDays, timeSlots) {
  return calendarDays.reduce((sum, day) => sum + getDayWidth(day, timeSlots), 0);
}

function getTodayLeft(calendarDays, today, timeSlots) {
  const todayIndex = calendarDays.findIndex((day) => dateKey(day) === dateKey(today));

  if (todayIndex < 0) return -1;

  return calendarDays
    .slice(0, todayIndex)
    .reduce((sum, day) => sum + getDayWidth(day, timeSlots), 0);
}

function getStepPlacementsForDay(steps, day, timeSlots) {
  const daySteps = steps
    .filter((step) => dateKey(step.startDate) === dateKey(day))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const placements = [];
  let cursor = 0;

  daySteps.forEach((step) => {
    let remainingMinutes = Math.max(SLOT_MINUTES, Math.round(safeNumber(step.plannedMinutes, SLOT_MINUTES)));

    while (remainingMinutes > 0 && cursor < timeSlots.length) {
      while (cursor < timeSlots.length && timeSlots[cursor].isBreak) {
        cursor += 1;
      }

      if (cursor >= timeSlots.length) break;

      const startIndex = cursor;
      let span = 0;

      while (
        cursor < timeSlots.length &&
        !timeSlots[cursor].isBreak &&
        remainingMinutes > 0
      ) {
        remainingMinutes -= SLOT_MINUTES;
        span += 1;
        cursor += 1;
      }

      if (span > 0) {
        placements.push({
          step,
          startIndex,
          span,
        });
      }
    }
  });

  return placements;
}

function truncateFileName(name) {
  if (!name) return 'No job pack';
  return name.length > 24 ? `${name.slice(0, 21)}...` : name;
}

function getStepIcon(department) {
  const key = String(department || '').toUpperCase();

  if (key.includes('MACHINE')) return <Factory size={13} />;
  if (key.includes('LABOUR')) return <Users size={13} />;
  if (key.includes('INSTALL')) return <Wrench size={13} />;
  if (key.includes('STOCK') || key.includes('PROCUREMENT')) return <Package size={13} />;
  if (key.includes('QC')) return <FileCheck size={13} />;
  if (key.includes('PACK')) return <PackageCheck size={13} />;
  if (key.includes('DISPATCH') || key.includes('DELIVERY')) return <Truck size={13} />;
  if (key.includes('DESIGN')) return <FileText size={13} />;

  return <ClipboardList size={13} />;
}

function getJobDate(job, today) {
  return startOfDay(
    job.production_posted_at ||
      job.production_started_at ||
      job.invoice_created_at ||
      job.created_at ||
      today
  );
}

function getJobLabel(job) {
  return `${job.invoice_number || job.quote_number || job.estimate_number || 'Job'} - ${job.client_name || 'Client'}`;
}

function getRecipeMachineEntries(job) {
  const blueprint = job.blueprint || {};
  const estimateLines = Array.isArray(blueprint.estimate_lines) ? blueprint.estimate_lines : [];
  const workflowEntries = [];

  estimateLines.forEach((line, estimateLineIndex) => {
    const qty = safeNumber(line.quantity, 1);
    const productName =
      line.item_name ||
      line.product_name ||
      line.recipe_name ||
      line.name ||
      line.description ||
      `Product ${estimateLineIndex + 1}`;

    if (Array.isArray(line.recipe_workflow) && line.recipe_workflow.length > 0) {
      line.recipe_workflow.forEach((entry, workflowIndex) => {
        workflowEntries.push({
          ...entry,
          quoteQuantity: qty,
          productName,
          estimateLineIndex,
          workflowIndex,
          sourceName: entry.name || productName,
          source: 'recipe_workflow',
        });
      });

      return;
    }

    if (Array.isArray(line.recipe_breakdown)) {
      line.recipe_breakdown.forEach((entry, workflowIndex) => {
        workflowEntries.push({
          ...entry,
          quoteQuantity: qty,
          productName,
          estimateLineIndex,
          workflowIndex,
          sourceName: line.item_name || line.product_name || line.recipe_name || entry.name,
          source: 'recipe_breakdown',
        });
      });
    }

    if (Array.isArray(line.breakdown)) {
      line.breakdown.forEach((entry, workflowIndex) => {
        workflowEntries.push({
          ...entry,
          quoteQuantity: qty,
          productName,
          estimateLineIndex,
          workflowIndex,
          sourceName: line.item_name || line.product_name || line.recipe_name || entry.name,
          source: 'breakdown',
        });
      });
    }
  });

  return workflowEntries.sort((a, b) => {
    const aOrder = Number(a.sequence_order) || 999;
    const bOrder = Number(b.sequence_order) || 999;

    if (aOrder !== bOrder) return aOrder - bOrder;

    const aEstimate = Number(a.estimateLineIndex) || 0;
    const bEstimate = Number(b.estimateLineIndex) || 0;

    if (aEstimate !== bEstimate) return aEstimate - bEstimate;

    return (Number(a.workflowIndex) || 0) - (Number(b.workflowIndex) || 0);
  });
}

function makeStep({
  id,
  name,
  department,
  resource,
  minutes,
  dayOffset,
  job,
  jobColour,
  today,
}) {
  const startDate = addWorkdays(getJobDate(job, today), dayOffset);

  return {
    id,
    name,
    department,
    resource: resource || department,
    plannedMinutes: Math.max(5, Math.round(safeNumber(minutes, 30))),
    startDate,
    endDate: startDate,
    jobId: job.id,
    jobLabel: getJobLabel(job),
    jobColour,
  };
}

function buildWorkflow(job, jobColour, today) {
  const steps = [];

  baseWorkflow.forEach((step, index) => {
    steps.push(
      makeStep({
        id: `${job.id}-base-${index}`,
        name: step.name,
        department: step.department,
        resource: step.department,
        minutes: step.minutes,
        dayOffset: step.dayOffset,
        job,
        jobColour,
        today,
      })
    );
  });

  const blueprint = job.blueprint || {};
  const estimateLines = Array.isArray(blueprint.estimate_lines) ? blueprint.estimate_lines : [];

  estimateLines.forEach((line, index) => {
    const qty = safeNumber(line.quantity, 1);
    const machineHours = safeNumber(line.machine_hours || line.machine_time_hours || line.production_hours, 0);
    const labourHours = safeNumber(line.labour_hours || line.labor_hours, 0);
    const installHours = safeNumber(line.install_hours || line.installation_hours, 0);

    const productName =
      line.item_name ||
      line.product_name ||
      line.recipe_name ||
      line.name ||
      line.description ||
      `Product ${index + 1}`;

    if (machineHours > 0) {
      steps.push(
        makeStep({
          id: `${job.id}-machine-line-${index}`,
          name: `Machine: ${productName}`,
          department: 'MACHINE',
          resource: line.machine_name || line.machine_type_name || 'Machine',
          minutes: machineHours * 60 + SETUP_MINUTES + REMOVAL_MINUTES,
          dayOffset: 2 + index,
          job,
          jobColour,
          today,
        })
      );
    }

    if (labourHours > 0) {
      steps.push(
        makeStep({
          id: `${job.id}-labour-line-${index}`,
          name: `Labour: ${productName}`,
          department: 'LABOUR',
          resource: line.labour_type_name || 'Labour',
          minutes: labourHours * 60 * qty,
          dayOffset: 2 + index,
          job,
          jobColour,
          today,
        })
      );
    }

    if (installHours > 0) {
      steps.push(
        makeStep({
          id: `${job.id}-install-line-${index}`,
          name: `Install: ${productName}`,
          department: 'INSTALLATION',
          resource: line.install_type_name || 'Installation',
          minutes: installHours * 60,
          dayOffset: 6 + index,
          job,
          jobColour,
          today,
        })
      );
    }
  });

  const recipeEntries = getRecipeMachineEntries(job);

  recipeEntries.forEach((entry, index) => {
    const rawType = String(entry.line_type || entry.type || entry.department || '').toUpperCase();
    const rawName = entry.name || entry.custom_name || entry.sourceName || entry.description || 'Production item';
    const qty = safeNumber(entry.quoteQuantity, 1);
    const sequenceOrder = Number(entry.sequence_order) || index + 1;
    const dependencyText = entry.dependency_steps ? ` | Depends on: ${entry.dependency_steps}` : '';

    let department = '';
    if (rawType.includes('MACHINE')) department = 'MACHINE';
    if (rawType.includes('LABOUR') || rawType.includes('LABOR')) department = 'LABOUR';
    if (rawType.includes('INSTALL')) department = 'INSTALLATION';
    if (rawType.includes('HIRE')) department = 'MACHINE HIRE';

    if (!department) return;

    const hours =
      safeNumber(entry.hours, 0) ||
      safeNumber(entry.time_hours, 0) ||
      safeNumber(entry.total_hours, 0) ||
      safeNumber(entry.quantity, 0);

    const minutes =
      hours > 0
        ? hours * 60 * qty
        : department === 'MACHINE'
          ? SETUP_MINUTES + REMOVAL_MINUTES + 30
          : 30;

    steps.push(
      makeStep({
        id: `${job.id}-recipe-${department}-${entry.estimateLineIndex || 0}-${sequenceOrder}-${index}`,
        name: `Step ${sequenceOrder}: ${rawName}${dependencyText}`,
        department,
        resource: rawName || entry.resource_name || entry.machine_name || entry.labour_type_name || entry.install_type_name || department,
        minutes,
        dayOffset: department === 'INSTALLATION' ? 6 : 2 + Math.max(0, sequenceOrder - 1),
        job,
        jobColour,
        today,
      })
    );
  });

  const installationItems = Array.isArray(job.installation_items) ? job.installation_items : [];
  installationItems.forEach((item, index) => {
    steps.push(
      makeStep({
        id: `${job.id}-install-item-${index}`,
        name: item.install_type_name || 'Installation',
        department: 'INSTALLATION',
        resource: item.install_type_name || 'Installation',
        minutes: safeNumber(item.hours, 0) * 60 || 60,
        dayOffset: 6 + index,
        job,
        jobColour,
        today,
      })
    );
  });

  return steps;
}

function downloadBlob(response, filename) {
  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

function DateHeader({ calendarDays, today, timeSlots }) {
  return (
    <>
      {calendarDays.map((day) => {
        const header = formatDayHeader(day, today);
        const width = getDayWidth(day, timeSlots);

        return (
          <div
            key={dateKey(day)}
            className={`h-[92px] border-r ${
              header.isToday ? 'bg-red-50 text-red-700' : header.weekend ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-500'
            }`}
            style={{ width: `${width}px` }}
          >
            <div className="border-b px-3 py-2 text-center">
              <div className="font-black">{header.top}</div>
              {header.bottom ? <div className="mt-1 text-[11px] font-black">{header.bottom}</div> : null}
            </div>

            {header.weekend ? (
              <div className="flex h-[36px] items-center justify-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
                No standard production
              </div>
            ) : (
              <div
                className="grid text-[9px]"
                style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
              >
                {timeSlots.map((slot) => (
                  <div
                    key={`${dateKey(day)}-${slot.key}`}
                    className={`h-[36px] border-r px-0.5 pt-1 text-center ${
                      slot.isBreak ? 'bg-amber-100 text-amber-700' : 'bg-white'
                    }`}
                    title={slot.isBreak ? `${slot.breakLabel}: ${slot.key}` : slot.key}
                  >
                    {slot.isHour ? slot.label : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function TodayLine({ calendarDays, today, timeSlots }) {
  const left = getTodayLeft(calendarDays, today, timeSlots);

  if (left < 0) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 z-30 h-full w-[3px] bg-red-600"
      style={{
        left: `${left}px`,
      }}
    />
  );
}

function StepCard({ step }) {
  return (
    <div
      className={`rounded-md ${step.jobColour.card} px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm`}
      title={`${step.jobLabel} | ${step.name} | ${formatHours(step.plannedMinutes)}`}
    >
      <div className="flex items-center gap-1">
        {getStepIcon(step.department)}
        <span className="truncate">{step.name}</span>
      </div>
      <div className="text-[9px] opacity-90">{formatHours(step.plannedMinutes)}</div>
    </div>
  );
}

export default function ProductionPage() {
  const [jobs, setJobs] = useState([]);
  const [companyDetails, setCompanyDetails] = useState(defaultCompanyDetails);
  const [jobSearch, setJobSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const jobScrollRef = useRef(null);
  const resourceScrollRef = useRef(null);

  const today = useMemo(() => startOfDay(new Date()), []);

  const calendarStart = useMemo(() => addDays(today, -DAYS_BACK), [today]);

  const calendarDays = useMemo(() => {
    return Array.from({ length: CALENDAR_DAYS }, (_, index) => addDays(calendarStart, index));
  }, [calendarStart]);

  const timeSlots = useMemo(() => buildTimeSlots(companyDetails), [companyDetails]);
  const calendarWidth = useMemo(() => getCalendarWidth(calendarDays, timeSlots), [calendarDays, timeSlots]);

  const loadJobs = async () => {
    try {
      setLoading(true);

      const [productionResponse, companyResponse] = await Promise.all([
        api.get('/production'),
        api.get('/company-details'),
      ]);

      setJobs(productionResponse.data || []);
      setCompanyDetails({
        ...defaultCompanyDetails,
        ...(companyResponse.data || {}),
      });
    } catch {
      toast.error('Failed to load production jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const scheduledJobs = useMemo(() => {
    return jobs.map((job, index) => {
      const colour = jobColours[index % jobColours.length];
      const steps = buildWorkflow(job, colour, today);
      const totalMinutes = steps.reduce((sum, step) => sum + safeNumber(step.plannedMinutes), 0);

      return {
        job,
        colour,
        steps,
        totalMinutes,
      };
    });
  }, [jobs, today]);

  useEffect(() => {
    if (loading) return;

    const scrollToToday = getTodayLeft(calendarDays, today, timeSlots);

    window.setTimeout(() => {
      if (jobScrollRef.current) {
        jobScrollRef.current.scrollLeft = scrollToToday;
      }

      if (resourceScrollRef.current) {
        resourceScrollRef.current.scrollLeft = scrollToToday;
      }
    }, 150);
  }, [loading, scheduledJobs.length, calendarDays, today, timeSlots]);

  const filteredJobs = useMemo(() => {
    const term = jobSearch.trim().toLowerCase();

    if (!term) return scheduledJobs;

    return scheduledJobs.filter(({ job }) => {
      return (
        String(job.client_name || '').toLowerCase().includes(term) ||
        String(job.invoice_number || '').toLowerCase().includes(term) ||
        String(job.quote_number || '').toLowerCase().includes(term) ||
        String(job.estimate_number || '').toLowerCase().includes(term)
      );
    });
  }, [scheduledJobs, jobSearch]);

  const resourceRows = useMemo(() => {
    const rows = new Map();

    scheduledJobs.forEach(({ steps }) => {
      steps.forEach((step) => {
        const department = String(step.department || 'OTHER').toUpperCase();

        if (departmentFilter !== 'ALL' && department !== departmentFilter) return;

        const resource = step.resource || department;
        const key = `${department}-${resource}`;

        if (!rows.has(key)) {
          rows.set(key, {
            id: key,
            department,
            resource,
            events: [],
          });
        }

        rows.get(key).events.push(step);
      });
    });

    return Array.from(rows.values());
  }, [scheduledJobs, departmentFilter]);

  const productionStats = useMemo(() => {
    const totalJobs = scheduledJobs.length;
    const totalSteps = scheduledJobs.reduce((sum, item) => sum + item.steps.length, 0);
    const totalMinutes = scheduledJobs.reduce((sum, item) => sum + item.totalMinutes, 0);

    return {
      totalJobs,
      totalSteps,
      totalMinutes,
    };
  }, [scheduledJobs]);

  const downloadJobPack = async (job) => {
    try {
      const response = await api.get(`/approved/${job.id}/job-ticket`, {
        responseType: 'blob',
      });

      downloadBlob(response, job.job_ticket_document_filename || `${job.invoice_number || 'job'}-job-ticket`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No job pack uploaded yet');
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl space-y-6 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Production Tracking</h1>
          <p className="mt-2 text-slate-600">
            Calendar view for posted production jobs, department capacity, machinery, labour and installation work.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Posted Jobs</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{productionStats.totalJobs}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Production Steps</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{productionStats.totalSteps}</div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">Planned Time</div>
            <div className="mt-1 text-2xl font-black text-blue-700">{formatHours(productionStats.totalMinutes)}</div>
          </div>
        </div>

        {/* JOB OVERVIEW CALENDAR */}
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50 p-4">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <CalendarDays size={18} />
              Job Overview Calendar
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The job column stays fixed. Only the date columns scroll left and right.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading production jobs...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No posted production jobs found.</div>
          ) : (
            <div className="grid min-w-0" style={{ gridTemplateColumns: `${JOB_COLUMN_WIDTH}px minmax(0, 1fr)` }}>
              <div className="border-r bg-white">
                <div className="h-[92px] border-b px-4 py-3">
                  <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Job</div>
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-2.5 text-slate-400" />
                    <Input
                      value={jobSearch}
                      onChange={(event) => setJobSearch(event.target.value)}
                      placeholder="Search jobs"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>

                {filteredJobs.map(({ job, colour, steps, totalMinutes }) => (
                  <div key={job.id} className="min-h-[148px] border-b bg-white px-4 py-4">
                    <div className="flex gap-3">
                      <div className={`mt-1 h-4 w-4 shrink-0 rounded-full ${colour.dot}`} />

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-slate-900">{getJobLabel(job)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {steps.length} steps • {formatHours(totalMinutes)}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClasses[job.production_status || 'QUEUED'] || statusClasses.QUEUED}`}>
                            {job.production_status || 'QUEUED'}
                          </span>

                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${job.job_ticket_document_filename ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {truncateFileName(job.job_ticket_document_filename)}
                          </span>
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
                ))}
              </div>

              <div ref={jobScrollRef} className="min-w-0 overflow-x-auto touch-pan-x">
                <div
                  className="relative"
                  style={{
                    width: `${calendarWidth}px`,
                  }}
                >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: calendarDays.map((day) => `${getDayWidth(day, timeSlots)}px`).join(' '),
                    }}
                  >
                    <DateHeader calendarDays={calendarDays} today={today} timeSlots={timeSlots} />
                  </div>

                  {filteredJobs.map(({ job, colour, steps }) => (
                    <div
                      key={job.id}
                      className="grid"
                      style={{
                        gridTemplateColumns: calendarDays.map((day) => `${getDayWidth(day, timeSlots)}px`).join(' '),
                      }}
                    >
                      {calendarDays.map((day) => {
                        const header = formatDayHeader(day, today);
                        const placements = header.weekend ? [] : getStepPlacementsForDay(steps, day, timeSlots);

                        return (
                          <div
                            key={`${job.id}-${dateKey(day)}`}
                            className={`relative min-h-[148px] border-b border-r ${
                              header.isToday ? 'bg-red-50/40' : header.weekend ? 'bg-slate-100' : 'bg-slate-50'
                            }`}
                          >
                            {header.weekend ? (
                              <div className="flex h-full min-h-[148px] items-center justify-center px-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Weekend
                              </div>
                            ) : (
                              <>
                                <div
                                  className="absolute inset-0 grid"
                                  style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
                                >
                                  {timeSlots.map((slot) => (
                                    <div
                                      key={`${job.id}-${dateKey(day)}-${slot.key}`}
                                      className={`border-r ${slot.isBreak ? 'bg-amber-100/70' : ''}`}
                                      title={slot.isBreak ? `${slot.breakLabel}: ${slot.key}` : slot.key}
                                    />
                                  ))}
                                </div>

                                <div
                                  className="relative z-10 grid gap-y-1 p-2"
                                  style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
                                >
                                  {placements.map((placement, placementIndex) => (
                                    <div
                                      key={`${placement.step.id}-${placementIndex}`}
                                      style={{
                                        gridColumn: `${placement.startIndex + 1} / span ${placement.span}`,
                                      }}
                                    >
                                      <StepCard step={placement.step} />
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <TodayLine calendarDays={calendarDays} today={today} timeSlots={timeSlots} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* DEPARTMENT / MACHINE CALENDAR */}
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Factory size={18} />
                Department / Machine Calendar
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Rows show resources so you can see when machinery, labour, installation and dispatch are busy.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-600">Department</label>
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="h-10 rounded-md border bg-white px-3 text-sm"
              >
                {departmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'All Departments' : option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading department calendar...</div>
          ) : resourceRows.length === 0 ? (
            <div className="p-12 text-center text-slate-500">No department items found for this filter.</div>
          ) : (
            <div className="grid min-w-0" style={{ gridTemplateColumns: `${RESOURCE_COLUMN_WIDTH}px minmax(0, 1fr)` }}>
              <div className="border-r bg-white">
                <div className="h-[92px] border-b px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                  Department / Resource
                </div>

                {resourceRows.map((row) => (
                  <div key={row.id} className="min-h-[118px] border-b bg-white px-4 py-4">
                    <div className="text-sm font-black text-slate-900">{row.resource}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.department}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {row.events.length} item{row.events.length === 1 ? '' : 's'}
                    </div>
                  </div>
                ))}
              </div>

              <div ref={resourceScrollRef} className="min-w-0 overflow-x-auto touch-pan-x">
                <div
                  className="relative"
                  style={{
                    width: `${calendarWidth}px`,
                  }}
                >
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: calendarDays.map((day) => `${getDayWidth(day, timeSlots)}px`).join(' '),
                    }}
                  >
                    <DateHeader calendarDays={calendarDays} today={today} timeSlots={timeSlots} />
                  </div>

                  {resourceRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid"
                      style={{
                        gridTemplateColumns: calendarDays.map((day) => `${getDayWidth(day, timeSlots)}px`).join(' '),
                      }}
                    >
                      {calendarDays.map((day) => {
                        const header = formatDayHeader(day, today);
                        const placements = header.weekend ? [] : getStepPlacementsForDay(row.events, day, timeSlots);

                        return (
                          <div
                            key={`${row.id}-${dateKey(day)}`}
                            className={`relative min-h-[118px] border-b border-r ${
                              header.isToday ? 'bg-red-50/40' : header.weekend ? 'bg-slate-100' : 'bg-slate-50'
                            }`}
                          >
                            {header.weekend ? (
                              <div className="flex h-full min-h-[118px] items-center justify-center px-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Weekend
                              </div>
                            ) : (
                              <>
                                <div
                                  className="absolute inset-0 grid"
                                  style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
                                >
                                  {timeSlots.map((slot) => (
                                    <div
                                      key={`${row.id}-${dateKey(day)}-${slot.key}`}
                                      className={`border-r ${slot.isBreak ? 'bg-amber-100/70' : ''}`}
                                      title={slot.isBreak ? `${slot.breakLabel}: ${slot.key}` : slot.key}
                                    />
                                  ))}
                                </div>

                                <div
                                  className="relative z-10 grid gap-y-1 p-2"
                                  style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
                                >
                                  {placements.map((placement, placementIndex) => (
                                    <div
                                      key={`${placement.step.id}-${placementIndex}`}
                                      style={{
                                        gridColumn: `${placement.startIndex + 1} / span ${placement.span}`,
                                      }}
                                    >
                                      <div
                                        className={`rounded-md ${placement.step.jobColour.card} px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm`}
                                        title={`${placement.step.jobLabel} | ${placement.step.name}`}
                                      >
                                        <div className="truncate">{placement.step.jobLabel}</div>
                                        <div className="truncate opacity-90">{placement.step.name}</div>
                                        <div className="text-[9px] opacity-90">{formatHours(placement.step.plannedMinutes)}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <TodayLine calendarDays={calendarDays} today={today} timeSlots={timeSlots} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
