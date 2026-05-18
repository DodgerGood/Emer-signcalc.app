import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Layout';
import api from '../lib/api';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import {
  CalendarDays,
  ChevronsDown,
  ChevronsRight,
  ClipboardList,
  Download,
  Factory,
  FileCheck,
  FileText,
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
const JOB_COLUMN_WIDTH = 340;
const RESOURCE_COLUMN_WIDTH = 300;
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
  { dot: 'bg-blue-500', card: 'bg-blue-500', soft: 'bg-blue-50', text: 'text-blue-700' },
  { dot: 'bg-emerald-500', card: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700' },
  { dot: 'bg-purple-500', card: 'bg-purple-500', soft: 'bg-purple-50', text: 'text-purple-700' },
  { dot: 'bg-orange-500', card: 'bg-orange-500', soft: 'bg-orange-50', text: 'text-orange-700' },
  { dot: 'bg-cyan-500', card: 'bg-cyan-500', soft: 'bg-cyan-50', text: 'text-cyan-700' },
  { dot: 'bg-rose-500', card: 'bg-rose-500', soft: 'bg-rose-50', text: 'text-rose-700' },
];

const statusClasses = {
  QUEUED: 'bg-slate-100 text-slate-700 border-slate-200',
  ACTIVE: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 border-blue-200',
  WAITING: 'bg-amber-100 text-amber-700 border-amber-200',
  COMPLETE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

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

const departmentOrder = {
  ADMIN: 1,
  DESIGN: 2,
  PROCUREMENT: 3,
  STOCK: 4,
  MACHINE: 5,
  LABOUR: 6,
  INSTALLATION: 7,
  'MACHINE HIRE': 8,
  QC: 9,
  PACKING: 10,
  DISPATCH: 11,
  OTHER: 99,
};

const defaultAdminStepMinutes = {
  jobPack: 30,
  design: 60,
  procurement: 60,
  productionBrief: 30,
  stockIssuing: 30,
  qc: 30,
  packing: 30,
  dispatch: 45,
  deliveryNoteSigned: 15,
  closeJob: 15,
};

const editableJobTimeFields = [
  { key: 'jobPack', label: 'Job Pack' },
  { key: 'design', label: 'Design' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'productionBrief', label: 'Production Brief' },
  { key: 'stockIssuing', label: 'Stock Issuing' },
  { key: 'qc', label: 'QC' },
  { key: 'packing', label: 'Packing' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'deliveryNoteSigned', label: 'Delivery Note Signed' },
  { key: 'closeJob', label: 'Close Job' },
];

const earlyWorkflow = [
  { name: 'Job Pack', department: 'ADMIN', minutes: 30, sequenceOrder: 10, adminKey: 'jobPack' },
  { name: 'Design', department: 'DESIGN', minutes: 60, sequenceOrder: 20, adminKey: 'design' },
  { name: 'Procurement', department: 'PROCUREMENT', minutes: 60, sequenceOrder: 30, adminKey: 'procurement' },
  { name: 'Production Brief', department: 'ADMIN', minutes: 30, sequenceOrder: 40, adminKey: 'productionBrief' },
  { name: 'Stock Issuing', department: 'STOCK', minutes: 30, sequenceOrder: 50, adminKey: 'stockIssuing' },
];

const lateWorkflow = [
  { name: 'QC', department: 'QC', minutes: 30, sequenceOrder: 900, adminKey: 'qc' },
  { name: 'Packing', department: 'PACKING', minutes: 30, sequenceOrder: 910, adminKey: 'packing' },
  { name: 'Dispatch', department: 'DISPATCH', minutes: 45, sequenceOrder: 920, adminKey: 'dispatch' },
  { name: 'Delivery Note Signed', department: 'DISPATCH', minutes: 15, sequenceOrder: 930, adminKey: 'deliveryNoteSigned' },
  { name: 'Close Job', department: 'ADMIN', minutes: 15, sequenceOrder: 940, adminKey: 'closeJob' },
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

function dateKey(date) {
  const localDate = startOfDay(date);
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
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

function getCurrentMinuteOfDay(now) {
  return now.getHours() * 60 + now.getMinutes();
}

function getCurrentTimeLeftInDay(day, now, timeSlots) {
  const dayWidth = getDayWidth(day, timeSlots);
  const currentMinute = getCurrentMinuteOfDay(now);

  if (isWeekend(day) || !timeSlots.length) {
    return dayWidth * (currentMinute / (24 * 60));
  }

  const firstSlot = timeSlots[0];
  const lastSlot = timeSlots[timeSlots.length - 1];

  if (currentMinute <= firstSlot.start) return 0;
  if (currentMinute >= lastSlot.end) return dayWidth;

  const slotIndex = timeSlots.findIndex((slot) => (
    currentMinute >= slot.start && currentMinute < slot.end
  ));

  if (slotIndex < 0) return 0;

  const slot = timeSlots[slotIndex];
  const slotProgress = (currentMinute - slot.start) / Math.max(1, slot.end - slot.start);

  return (slotIndex * SLOT_WIDTH) + (slotProgress * SLOT_WIDTH);
}

function formatDateBadge(value) {
  if (!value) return 'Not set';

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10) || 'Not set';

  return date.toISOString().slice(0, 10);
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

function getAdminResource(job) {
  return (
    job.created_by_name ||
    job.quoted_by_name ||
    job.estimate_created_by_name ||
    job.sales_person_name ||
    job.user_name ||
    job.created_by_email ||
    'Unassigned Admin'
  );
}

function getDefaultResourceForDepartment(job, department, fallback = '') {
  const cleanFallback = fallback || department;

  if (department === 'ADMIN') return getAdminResource(job);
  if (department === 'DESIGN') return job.designer_name || 'Design';
  if (department === 'PROCUREMENT') return job.procurement_name || 'Procurement';
  if (department === 'STOCK') return job.stock_controller_name || 'Stock';
  if (department === 'QC') return job.qc_name || 'QC';
  if (department === 'PACKING') return job.packing_name || 'Packing';
  if (department === 'DISPATCH') return job.dispatch_name || 'Dispatch';

  return cleanFallback;
}

function normalizeDepartment(value) {
  const rawType = String(value || '').toUpperCase();

  if (rawType.includes('MACHINE') && rawType.includes('HIRE')) return 'MACHINE HIRE';
  if (rawType.includes('MACHINE')) return 'MACHINE';
  if (rawType.includes('LABOUR') || rawType.includes('LABOR')) return 'LABOUR';
  if (rawType.includes('INSTALL')) return 'INSTALLATION';
  if (rawType.includes('DESIGN')) return 'DESIGN';
  if (rawType.includes('PROCUREMENT')) return 'PROCUREMENT';
  if (rawType.includes('STOCK')) return 'STOCK';
  if (rawType.includes('QC')) return 'QC';
  if (rawType.includes('PACK')) return 'PACKING';
  if (rawType.includes('DISPATCH') || rawType.includes('DELIVERY')) return 'DISPATCH';
  if (rawType.includes('ADMIN')) return 'ADMIN';

  return '';
}

function getEstimateLines(job) {
  const blueprint = job.blueprint || {};
  return Array.isArray(blueprint.estimate_lines) ? blueprint.estimate_lines : [];
}

function getRecipeWorkflowEntries(job) {
  const estimateLines = getEstimateLines(job);
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

    const sources = [
      { key: 'recipe_workflow', value: line.recipe_workflow },
      { key: 'recipe_breakdown', value: line.recipe_breakdown },
      { key: 'breakdown', value: line.breakdown },
    ];

    sources.forEach((source) => {
      if (!Array.isArray(source.value)) return;

      source.value.forEach((entry, workflowIndex) => {
        workflowEntries.push({
          ...entry,
          quoteQuantity: qty,
          productName,
          estimateLineIndex,
          workflowIndex,
          sourceName: entry.name || line.item_name || line.product_name || line.recipe_name || productName,
          source: source.key,
        });
      });
    });
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

function makeRawStep({
  id,
  name,
  department,
  resource,
  minutes,
  sequenceOrder,
  dependencySteps,
  job,
  jobColour,
  today,
  productName,
}) {
  const safeDepartment = department || 'OTHER';

  return {
    id,
    name,
    department: safeDepartment,
    resource: resource || getDefaultResourceForDepartment(job, safeDepartment, safeDepartment),
    plannedMinutes: Math.max(5, Math.round(safeNumber(minutes, 30))),
    sequenceOrder: Number(sequenceOrder) || 999,
    dependencySteps: dependencySteps || '',
    jobId: job.id,
    job,
    jobLabel: getJobLabel(job),
    jobColour,
    productName: productName || '',
    earliestDate: getJobDate(job, today),
    dependsOnIds: [],
  };
}

function buildRawWorkflow(job, jobColour, today, adminStepMinutes = defaultAdminStepMinutes) {
  const steps = [];

  earlyWorkflow.forEach((step, index) => {
    steps.push(
      makeRawStep({
        id: `${job.id}-base-early-${index}`,
        name: step.name,
        department: step.department,
        resource: getDefaultResourceForDepartment(job, step.department, step.department),
        minutes: step.adminKey ? (adminStepMinutes[step.adminKey] ?? step.minutes) : step.minutes,
        sequenceOrder: step.sequenceOrder,
        job,
        jobColour,
        today,
      })
    );
  });

  const estimateLines = getEstimateLines(job);

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
        makeRawStep({
          id: `${job.id}-machine-line-${index}`,
          name: `Machine: ${productName}`,
          department: 'MACHINE',
          resource: line.machine_name || line.machine_type_name || 'Machine',
          minutes: machineHours * 60 + SETUP_MINUTES + REMOVAL_MINUTES,
          sequenceOrder: 100 + index,
          job,
          jobColour,
          today,
          productName,
        })
      );
    }

    if (labourHours > 0) {
      steps.push(
        makeRawStep({
          id: `${job.id}-labour-line-${index}`,
          name: `Labour: ${productName}`,
          department: 'LABOUR',
          resource: line.labour_type_name || 'Labour',
          minutes: labourHours * 60 * qty,
          sequenceOrder: 110 + index,
          job,
          jobColour,
          today,
          productName,
        })
      );
    }

    if (installHours > 0) {
      steps.push(
        makeRawStep({
          id: `${job.id}-install-line-${index}`,
          name: `Install: ${productName}`,
          department: 'INSTALLATION',
          resource: line.install_type_name || 'Installation',
          minutes: installHours * 60,
          sequenceOrder: 800 + index,
          job,
          jobColour,
          today,
          productName,
        })
      );
    }
  });

  const recipeEntries = getRecipeWorkflowEntries(job);

  recipeEntries.forEach((entry, index) => {
    const department = normalizeDepartment(entry.line_type || entry.type || entry.department);
    if (!department) return;

    const rawName = entry.name || entry.custom_name || entry.sourceName || entry.description || 'Production item';
    const qty = safeNumber(entry.quoteQuantity, 1);
    const sequenceOrder = Number(entry.sequence_order) || index + 1;
    const dependencySteps = entry.dependency_steps || '';
    const dependencyText = dependencySteps ? ` | Depends on: ${dependencySteps}` : '';

    const hours =
      safeNumber(entry.hours, 0) ||
      safeNumber(entry.time_hours, 0) ||
      safeNumber(entry.total_hours, 0) ||
      safeNumber(entry.production_hours, 0);

    const minutes =
      hours > 0
        ? hours * 60 * qty
        : department === 'MACHINE'
          ? SETUP_MINUTES + REMOVAL_MINUTES + 30
          : 30;

    const resource =
      entry.resource_name ||
      entry.machine_name ||
      entry.machine_type_name ||
      entry.labour_type_name ||
      entry.install_type_name ||
      rawName ||
      department;

    steps.push(
      makeRawStep({
        id: `${job.id}-recipe-${department}-${entry.estimateLineIndex || 0}-${sequenceOrder}-${index}`,
        name: `Step ${sequenceOrder}: ${rawName}${dependencyText}`,
        department,
        resource,
        minutes,
        sequenceOrder: 100 + sequenceOrder,
        dependencySteps,
        job,
        jobColour,
        today,
        productName: entry.productName,
      })
    );
  });

  const installationItems = Array.isArray(job.installation_items) ? job.installation_items : [];
  installationItems.forEach((item, index) => {
    steps.push(
      makeRawStep({
        id: `${job.id}-install-item-${index}`,
        name: item.install_type_name || 'Installation',
        department: 'INSTALLATION',
        resource: item.install_type_name || 'Installation',
        minutes: safeNumber(item.hours, 0) * 60 || 60,
        sequenceOrder: 820 + index,
        job,
        jobColour,
        today,
      })
    );
  });

  lateWorkflow.forEach((step, index) => {
    steps.push(
      makeRawStep({
        id: `${job.id}-base-late-${index}`,
        name: step.name,
        department: step.department,
        resource: getDefaultResourceForDepartment(job, step.department, step.department),
        minutes: step.adminKey ? (adminStepMinutes[step.adminKey] ?? step.minutes) : step.minutes,
        sequenceOrder: step.sequenceOrder,
        job,
        jobColour,
        today,
      })
    );
  });

  return applyJobDependencies(steps);
}

function parseDependencyNumbers(value) {
  if (!value) return [];

  return String(value)
    .split(/[,;| ]+/)
    .map((part) => Number(String(part).replace(/[^\d.-]/g, '')))
    .filter((number) => Number.isFinite(number) && number > 0);
}

function applyJobDependencies(steps) {
  const sorted = [...steps].sort((a, b) => {
    if (a.sequenceOrder !== b.sequenceOrder) return a.sequenceOrder - b.sequenceOrder;
    return String(a.id).localeCompare(String(b.id));
  });

  const byRecipeNumber = new Map();

  sorted.forEach((step) => {
    const match = String(step.name || '').match(/^Step\s+(\d+)/i);
    if (match) {
      byRecipeNumber.set(Number(match[1]), step.id);
    }
  });

  sorted.forEach((step, index) => {
    const deps = new Set();

    if (index > 0) {
      deps.add(sorted[index - 1].id);
    }

    parseDependencyNumbers(step.dependencySteps).forEach((number) => {
      const mapped = byRecipeNumber.get(number);
      if (mapped) deps.add(mapped);
    });

    step.dependsOnIds = Array.from(deps).filter((id) => id !== step.id);
  });

  return sorted;
}

function buildCalendarSlots(calendarDays, timeSlots) {
  const slots = [];

  calendarDays.forEach((day) => {
    if (isWeekend(day)) return;

    timeSlots.forEach((slot, slotIndex) => {
      if (slot.isBreak) return;

      slots.push({
        globalIndex: slots.length,
        day,
        dayKey: dateKey(day),
        slot,
        slotIndex,
      });
    });
  });

  return slots;
}

function findFirstCalendarSlotIndex(calendarSlots, targetDate) {
  const targetKey = dateKey(targetDate);
  const found = calendarSlots.findIndex((slot) => slot.dayKey >= targetKey);
  return found >= 0 ? found : 0;
}

function getSlotKey(slot) {
  return `${slot.dayKey}-${slot.slotIndex}`;
}

function sameSegmentRun(previousSlot, currentSlot) {
  return (
    previousSlot &&
    currentSlot &&
    previousSlot.dayKey === currentSlot.dayKey &&
    currentSlot.slotIndex === previousSlot.slotIndex + 1
  );
}

function scheduleSteps(rawSteps, calendarDays, timeSlots) {
  const calendarSlots = buildCalendarSlots(calendarDays, timeSlots);
  const resourceBusy = new Map();
  const scheduledStepEndIndex = new Map();
  const scheduledIds = new Set();
  const segments = [];
  const unscheduled = [...rawSteps].sort((a, b) => {
    const aStart = getJobDate(a.job, new Date()).getTime();
    const bStart = getJobDate(b.job, new Date()).getTime();

    if (aStart !== bStart) return aStart - bStart;
    if (a.sequenceOrder !== b.sequenceOrder) return a.sequenceOrder - b.sequenceOrder;

    return String(a.id).localeCompare(String(b.id));
  });

  let guard = 0;

  while (unscheduled.length > 0 && guard < rawSteps.length * 5) {
    guard += 1;
    let scheduledSomething = false;

    for (let i = 0; i < unscheduled.length; i += 1) {
      const step = unscheduled[i];
      const dependenciesReady = step.dependsOnIds.every((id) => scheduledIds.has(id));

      if (!dependenciesReady) continue;

      const dependencyEndIndex = step.dependsOnIds.reduce((max, id) => {
        return Math.max(max, scheduledStepEndIndex.get(id) ?? 0);
      }, 0);

      const jobStartIndex = findFirstCalendarSlotIndex(calendarSlots, step.earliestDate);
      const earliestIndex = Math.max(jobStartIndex, dependencyEndIndex);
      const resourceKey = `${step.department}-${step.resource}`;
      const busySet = resourceBusy.get(resourceKey) || new Set();

      let remainingMinutes = Math.max(SLOT_MINUTES, Math.ceil(step.plannedMinutes / SLOT_MINUTES) * SLOT_MINUTES);
      let currentSegment = null;
      let previousAllocatedSlot = null;
      let lastAllocatedIndex = earliestIndex;

      for (let slotPointer = earliestIndex; slotPointer < calendarSlots.length && remainingMinutes > 0; slotPointer += 1) {
        const calendarSlot = calendarSlots[slotPointer];
        const busyKey = getSlotKey(calendarSlot);

        if (busySet.has(busyKey)) {
          previousAllocatedSlot = null;
          currentSegment = null;
          continue;
        }

        busySet.add(busyKey);
        lastAllocatedIndex = slotPointer + 1;

        if (!currentSegment || !sameSegmentRun(previousAllocatedSlot, calendarSlot)) {
          currentSegment = {
            id: `${step.id}-segment-${segments.length}`,
            step,
            jobId: step.jobId,
            resourceKey,
            dayKey: calendarSlot.dayKey,
            startIndex: calendarSlot.slotIndex,
            span: 0,
            displayMinutes: 0,
          };
          segments.push(currentSegment);
        }

        currentSegment.span += 1;
        currentSegment.displayMinutes += SLOT_MINUTES;
        remainingMinutes -= SLOT_MINUTES;
        previousAllocatedSlot = calendarSlot;
      }

      resourceBusy.set(resourceKey, busySet);
      scheduledStepEndIndex.set(step.id, lastAllocatedIndex);
      scheduledIds.add(step.id);
      unscheduled.splice(i, 1);
      scheduledSomething = true;
      break;
    }

    if (!scheduledSomething) {
      unscheduled.forEach((step) => {
        scheduledIds.add(step.id);
        scheduledStepEndIndex.set(step.id, calendarSlots.length);
      });
      break;
    }
  }

  return {
    segments,
    scheduledIds,
    unscheduled,
  };
}

function getSegmentsForDay(segments, day) {
  const key = dateKey(day);

  return segments
    .filter((segment) => segment.dayKey === key)
    .sort((a, b) => {
      if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
      return String(a.step.id).localeCompare(String(b.step.id));
    });
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
              <div className="relative h-[36px]">
                <div
                  className="absolute inset-0 grid text-[9px]"
                  style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
                >
                  {timeSlots.map((slot) => (
                    <div
                      key={`${dateKey(day)}-${slot.key}`}
                      className={`h-[36px] border-r ${
                        slot.isHour ? 'border-l-2 border-l-slate-400' : 'border-l border-l-slate-200'
                      } ${slot.isBreak ? 'bg-amber-100 text-amber-700' : 'bg-white'}`}
                      title={slot.isBreak ? `${slot.breakLabel}: ${slot.key}` : slot.key}
                    />
                  ))}
                </div>

                {timeSlots.map((slot, slotIndex) => {
                  if (!slot.isHour) return null;

                  const nextHourIndex = timeSlots.findIndex((nextSlot, nextIndex) => (
                    nextIndex > slotIndex && nextSlot.isHour
                  ));

                  const endIndex = nextHourIndex === -1 ? timeSlots.length : nextHourIndex;
                  const hourSpan = Math.max(1, endIndex - slotIndex);
                  const left = slotIndex * SLOT_WIDTH;
                  const width = hourSpan * SLOT_WIDTH;

                  return (
                    <div
                      key={`${dateKey(day)}-${slot.key}-hour-label`}
                      className="pointer-events-none absolute top-1 text-center text-[9px] font-semibold"
                      style={{
                        left: `${left}px`,
                        width: `${width}px`,
                      }}
                    >
                      {slot.label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function TodayLine({ calendarDays, now, timeSlots }) {
  const today = startOfDay(now);
  const left = getTodayLeft(calendarDays, today, timeSlots);

  if (left < 0) return null;

  const todayDay = calendarDays.find((day) => dateKey(day) === dateKey(today));
  if (!todayDay) return null;

  return (
    <div
      className="pointer-events-none absolute top-0 z-30 h-full w-[3px] bg-red-600"
      style={{
        left: `${left + getCurrentTimeLeftInDay(todayDay, now, timeSlots)}px`,
      }}
      title={`Current time: ${now.toLocaleString('en-ZA')}`}
    />
  );
}

function StepCard({ segment, compact = false }) {
  const step = segment.step;

  return (
    <div
      className={`cursor-help rounded-md ${step.jobColour.card} px-2 py-1 text-[10px] font-bold leading-tight text-white shadow-sm`}
      title={`Job: ${step.jobLabel}\nStep: ${step.name}\nDepartment: ${step.department}\nResource: ${step.resource}\nThis block: ${formatHours(segment.displayMinutes)}\nTotal step time: ${formatHours(step.plannedMinutes)}${step.dependencySteps ? `\nDepends on: ${step.dependencySteps}` : ''}${step.productName ? `\nProduct: ${step.productName}` : ''}`}
    >
      <div className="flex items-center gap-1">
        {getStepIcon(step.department)}
        <span className="truncate">{compact ? step.name : step.jobLabel}</span>
      </div>
      {!compact && <div className="truncate opacity-90">{step.name}</div>}
      <div className="text-[9px] opacity-90">
        {formatHours(segment.displayMinutes)}
        {segment.displayMinutes < step.plannedMinutes ? ` of ${formatHours(step.plannedMinutes)}` : ''}
      </div>
    </div>
  );
}

export default function ProductionPage() {
  const [jobs, setJobs] = useState([]);
  const [companyDetails, setCompanyDetails] = useState(defaultCompanyDetails);
  const [jobSearch, setJobSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [jobAdminStepMinutes, setJobAdminStepMinutes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('signomics-production-job-admin-step-minutes') || '{}');
    } catch {
      return {};
    }
  });
  const [expandedJobCards, setExpandedJobCards] = useState({});

  const jobScrollRef = useRef(null);
  const resourceScrollRef = useRef(null);

  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => startOfDay(now), [now]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('signomics-production-job-admin-step-minutes', JSON.stringify(jobAdminStepMinutes));
  }, [jobAdminStepMinutes]);

  const getJobAdminStepMinutes = useCallback((jobId) => {
    const saved = jobAdminStepMinutes?.[jobId] || {};

    return Object.fromEntries(
      Object.entries(defaultAdminStepMinutes).map(([key, defaultValue]) => [
        key,
        saved[key] ?? String(defaultValue),
      ])
    );
  }, [jobAdminStepMinutes]);

  const getJobAdminStepNumber = useCallback((jobId, key) => {
    const rawValue = getJobAdminStepMinutes(jobId)[key];

    if (rawValue === '') return 0;

    const number = Number(rawValue);
    return Number.isFinite(number) ? Math.max(0, Math.round(number)) : defaultAdminStepMinutes[key];
  }, [getJobAdminStepMinutes]);

  const updateJobAdminStepMinutes = (jobId, key, value) => {
    const cleaned = String(value || '').replace(/[^0-9]/g, '');

    setJobAdminStepMinutes((prev) => ({
      ...prev,
      [jobId]: {
        ...getJobAdminStepMinutes(jobId),
        ...prev[jobId],
        [key]: cleaned,
      },
    }));
  };

  const normaliseJobAdminStepMinutes = (jobId, key) => {
    setJobAdminStepMinutes((prev) => {
      const current = prev[jobId] || getJobAdminStepMinutes(jobId);
      const rawValue = current[key];

      if (rawValue === '') {
        return {
          ...prev,
          [jobId]: {
            ...current,
            [key]: '',
          },
        };
      }

      const number = Math.max(0, Math.round(Number(rawValue) || 0));

      return {
        ...prev,
        [jobId]: {
          ...current,
          [key]: String(number),
        },
      };
    });
  };

  const toggleJobCard = (jobId) => {
    setExpandedJobCards((prev) => ({
      ...prev,
      [jobId]: !prev[jobId],
    }));
  };

  const updateJobLine = (job) => {
    const savedTimes = getJobAdminStepMinutes(job.id);

    setJobAdminStepMinutes((prev) => ({
      ...prev,
      [job.id]: savedTimes,
    }));

    toast.success(`${job.invoice_number || job.quote_number || job.estimate_number || 'Job'} production times updated`);
  };

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

  const scheduledData = useMemo(() => {
    const jobModels = jobs.map((job, index) => {
      const colour = jobColours[index % jobColours.length];
      const rawSteps = buildRawWorkflow(
        job,
        colour,
        today,
        Object.fromEntries(
          Object.keys(defaultAdminStepMinutes).map((key) => [
            key,
            getJobAdminStepNumber(job.id, key),
          ])
        )
      );
      const totalMinutes = rawSteps.reduce((sum, step) => sum + safeNumber(step.plannedMinutes), 0);

      return {
        job,
        colour,
        rawSteps,
        totalMinutes,
      };
    });

    const allSteps = jobModels.flatMap((item) => item.rawSteps);
    const schedule = scheduleSteps(allSteps, calendarDays, timeSlots);

    const segmentsByJob = new Map();

    schedule.segments.forEach((segment) => {
      if (!segmentsByJob.has(segment.jobId)) {
        segmentsByJob.set(segment.jobId, []);
      }

      segmentsByJob.get(segment.jobId).push(segment);
    });

    const scheduledJobs = jobModels.map((item) => ({
      ...item,
      segments: segmentsByJob.get(item.job.id) || [],
    }));

    return {
      scheduledJobs,
      allSegments: schedule.segments,
      allSteps,
      unscheduled: schedule.unscheduled,
    };
  }, [jobs, today, calendarDays, timeSlots, getJobAdminStepNumber]);

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
  }, [loading, scheduledData.scheduledJobs.length, calendarDays, today, timeSlots]);

  const filteredJobs = useMemo(() => {
    const term = jobSearch.trim().toLowerCase();

    if (!term) return scheduledData.scheduledJobs;

    return scheduledData.scheduledJobs.filter(({ job }) => {
      return (
        String(job.client_name || '').toLowerCase().includes(term) ||
        String(job.invoice_number || '').toLowerCase().includes(term) ||
        String(job.quote_number || '').toLowerCase().includes(term) ||
        String(job.estimate_number || '').toLowerCase().includes(term)
      );
    });
  }, [scheduledData.scheduledJobs, jobSearch]);

  const resourceRows = useMemo(() => {
    const rows = new Map();

    scheduledData.allSegments.forEach((segment) => {
      const step = segment.step;
      const department = String(step.department || 'OTHER').toUpperCase();

      if (departmentFilter !== 'ALL' && department !== departmentFilter) return;

      const resource = step.resource || department;
      const key = `${department}-${resource}`;

      if (!rows.has(key)) {
        rows.set(key, {
          id: key,
          department,
          resource,
          segments: [],
          totalMinutes: 0,
        });
      }

      rows.get(key).segments.push(segment);
      rows.get(key).totalMinutes += safeNumber(segment.displayMinutes, 0);
    });

    return Array.from(rows.values()).sort((a, b) => {
      const orderA = departmentOrder[a.department] || departmentOrder.OTHER;
      const orderB = departmentOrder[b.department] || departmentOrder.OTHER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return String(a.resource || '').localeCompare(String(b.resource || ''));
    });
  }, [scheduledData.allSegments, departmentFilter]);

  const productionStats = useMemo(() => {
    const totalJobs = scheduledData.scheduledJobs.length;
    const totalSteps = scheduledData.allSteps.length;
    const totalMinutes = scheduledData.allSteps.reduce((sum, step) => sum + step.plannedMinutes, 0);

    return {
      totalJobs,
      totalSteps,
      totalMinutes,
    };
  }, [scheduledData]);

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
      <div className="w-full space-y-6 fade-in">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Production Tracking</h1>
          <p className="mt-2 text-slate-600">
            Capacity-based production schedule from quote data, recipe steps, staff, machines, labour and installation.
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

<section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-slate-50 p-4">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <CalendarDays size={18} />
              Job Overview Calendar
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Jobs are split across available production time. Breaks, weekends and dependent steps are respected.
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

                {filteredJobs.map(({ job, colour, rawSteps, totalMinutes }) => (
                  <div key={job.id} className="min-h-[110px] border-b bg-white px-4 py-4">
                    <div className="flex gap-3">
                      <div className={`mt-1 h-4 w-4 shrink-0 rounded-full ${colour.dot}`} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">
                            {getJobLabel(job)}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleJobCard(job.id)}
                            className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title={expandedJobCards[job.id] ? 'Hide job details' : 'Show job details'}
                          >
                            {expandedJobCards[job.id] ? (
                              <ChevronsDown size={17} />
                            ) : (
                              <ChevronsRight size={17} />
                            )}
                          </button>
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {rawSteps.length} steps • {formatHours(totalMinutes)}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${statusClasses[job.production_status || 'QUEUED'] || statusClasses.QUEUED}`}>
                            {job.production_status || 'QUEUED'}
                          </span>

                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${job.job_ticket_document_filename ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {truncateFileName(job.job_ticket_document_filename)}
                          </span>

                          <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                            Launched: {formatDateBadge(job.production_posted_at)}
                          </span>

                          <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${job.due_date ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            Due: {formatDateBadge(job.due_date)}
                          </span>
                        </div>

                        {expandedJobCards[job.id] && (
                          <div className="mt-3 space-y-3 rounded-xl border bg-slate-50 p-3">
                            <div className="grid gap-2 text-[11px] text-slate-600">
                              <div><span className="font-black">Invoice / Job:</span> {job.invoice_number || job.quote_number || job.estimate_number || 'Not set'}</div>
                              <div><span className="font-black">Client:</span> {job.client_name || 'Not set'}</div>
                              <div><span className="font-black">Into Production:</span> {formatDateBadge(job.production_posted_at)}</div>
                              <div><span className="font-black">Due Date:</span> {formatDateBadge(job.due_date)}</div>
                            </div>

                            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-blue-800">
                              Enter planning time in minutes. Example: 30 = 30 minutes, 60 = 1 hour, 120 = 2 hours.
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {editableJobTimeFields.map((field) => (
                                <label key={`${job.id}-${field.key}`} className="space-y-1 text-[10px] font-bold text-slate-600">
                                  <span>{field.label} <span className="font-semibold text-slate-400">(min)</span></span>
                                  <div className="relative">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      value={getJobAdminStepMinutes(job.id)[field.key]}
                                      onChange={(event) => updateJobAdminStepMinutes(job.id, field.key, event.target.value)}
                                      onBlur={() => normaliseJobAdminStepMinutes(job.id, field.key)}
                                      className="h-7 px-2 pr-10 text-xs"
                                      placeholder="0"
                                      title={`${field.label} time in minutes`}
                                    />
                                    <span className="pointer-events-none absolute right-2 top-1.5 text-[10px] font-bold text-slate-400">
                                      min
                                    </span>
                                  </div>
                                </label>
                              ))}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => updateJobLine(job)}
                                className="h-8 bg-[#2563EB] text-xs text-white hover:bg-[#1d4ed8]"
                              >
                                Update Job Line
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => downloadJobPack(job)}
                                className="h-8 gap-2 text-xs"
                              >
                                <Download size={14} />
                                Download Job Pack
                              </Button>
                            </div>
                          </div>
                        )}
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

                  {filteredJobs.map(({ job, segments }) => (
                    <div
                      key={job.id}
                      className="grid"
                      style={{
                        gridTemplateColumns: calendarDays.map((day) => `${getDayWidth(day, timeSlots)}px`).join(' '),
                      }}
                    >
                      {calendarDays.map((day) => {
                        const header = formatDayHeader(day, today);
                        const placements = header.weekend ? [] : getSegmentsForDay(segments, day);

                        return (
                          <div
                            key={`${job.id}-${dateKey(day)}`}
                            className={`relative min-h-[110px] border-b border-r ${
                              header.isToday ? 'bg-red-50/40' : header.weekend ? 'bg-slate-100' : 'bg-slate-50'
                            }`}
                          >
                            {header.weekend ? (
                              <div className="flex h-full min-h-[110px] items-center justify-center px-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
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
                                      className={`border-r ${
                                        slot.isHour ? 'border-l-2 border-l-slate-300' : 'border-l border-l-slate-100'
                                      } ${slot.isBreak ? 'bg-amber-100/70' : ''}`}
                                      title={slot.isBreak ? `${slot.breakLabel}: ${slot.key}` : slot.key}
                                    />
                                  ))}
                                </div>

                                <div
                                  className="relative z-10 grid gap-y-1 p-2"
                                  style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
                                >
                                  {placements.map((segment) => (
                                    <div
                                      key={segment.id}
                                      style={{
                                        gridColumn: `${segment.startIndex + 1} / span ${segment.span}`,
                                      }}
                                    >
                                      <StepCard segment={segment} compact />
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

                  <TodayLine calendarDays={calendarDays} now={now} timeSlots={timeSlots} />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Factory size={18} />
                Department / Resource Calendar
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Admin now shows by quoting staff member. Other rows show the actual resource, machine, labour, installation or department.
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
                  <div key={row.id} className="min-h-[110px] border-b bg-white px-4 py-4">
                    <div className="text-sm font-black text-slate-900">{row.resource}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.department}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {row.segments.length} item{row.segments.length === 1 ? '' : 's'} • {formatHours(row.totalMinutes)}
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
                        const placements = header.weekend ? [] : getSegmentsForDay(row.segments, day);

                        return (
                          <div
                            key={`${row.id}-${dateKey(day)}`}
                            className={`relative min-h-[110px] border-b border-r ${
                              header.isToday ? 'bg-red-50/40' : header.weekend ? 'bg-slate-100' : 'bg-slate-50'
                            }`}
                          >
                            {header.weekend ? (
                              <div className="flex h-full min-h-[110px] items-center justify-center px-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
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
                                      className={`border-r ${
                                        slot.isHour ? 'border-l-2 border-l-slate-300' : 'border-l border-l-slate-100'
                                      } ${slot.isBreak ? 'bg-amber-100/70' : ''}`}
                                      title={slot.isBreak ? `${slot.breakLabel}: ${slot.key}` : slot.key}
                                    />
                                  ))}
                                </div>

                                <div
                                  className="relative z-10 grid gap-y-1 p-2"
                                  style={{ gridTemplateColumns: timeSlots.map(() => `${SLOT_WIDTH}px`).join(' ') }}
                                >
                                  {placements.map((segment) => (
                                    <div
                                      key={segment.id}
                                      style={{
                                        gridColumn: `${segment.startIndex + 1} / span ${segment.span}`,
                                      }}
                                    >
                                      <StepCard segment={segment} />
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

                  <TodayLine calendarDays={calendarDays} now={now} timeSlots={timeSlots} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
