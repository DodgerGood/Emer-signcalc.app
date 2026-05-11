import React from 'react';
import { Button } from './ui/button';

export default function ActionIconButton({
  icon,
  label,
  onClick,
  variant = 'ghost',
  size = 'sm',
  buttonClassName = '',
  labelClassName = '',
  disabled = false,
  type = 'button',
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
        className={buttonClassName}
        title={title || label}
      >
        {icon}
      </Button>

      <span className={`text-center text-[10px] leading-none text-slate-400 ${labelClassName}`}>
        {label}
      </span>
    </div>
  );
}
