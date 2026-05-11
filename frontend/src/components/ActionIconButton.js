import React from 'react';
import { Button } from './ui/button';

const toneClasses = {
  default: 'text-slate-600 hover:text-slate-800 hover:bg-slate-50',
  info: 'text-sky-600 hover:text-sky-700 hover:bg-sky-50',
  edit: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
  delete: 'text-red-600 hover:text-red-700 hover:bg-red-50',
  approve: 'text-green-600 hover:text-green-700 hover:bg-green-50',
  pdf: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50',
  upload: 'text-purple-600 hover:text-purple-700 hover:bg-purple-50',
  credit: 'text-violet-600 hover:text-violet-700 hover:bg-violet-50',
  return: 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50',
  production: 'text-orange-600 hover:text-orange-700 hover:bg-orange-50',
};

export default function ActionIconButton({
  icon,
  label,
  onClick,
  tone = 'default',
  variant = 'ghost',
  size = 'sm',
  disabled = false,
  type = 'button',
  className = '',
  title,
}) {
  return (
    <div className="flex min-w-[52px] flex-col items-center gap-1">
      <Button
        type={type}
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={onClick}
        title={title || label}
        className={`${toneClasses[tone] || toneClasses.default} ${className}`}
      >
        {icon}
      </Button>

      <span className="text-center text-[10px] leading-none text-slate-400">
        {label}
      </span>
    </div>
  );
}
