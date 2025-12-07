import React from 'react';
import { cn } from '@/lib/utils';

interface TerminalModuleProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  glow?: boolean;
}

export const TerminalModule = ({ 
  children, 
  className, 
  title, 
  icon, 
  action,
  glow = false,
  ...props 
}: TerminalModuleProps) => {
  return (
    <div 
      className={cn(
        "relative bg-card border border-border flex flex-col overflow-hidden transition-all duration-300",
        glow && "shadow-[0_0_15px_rgba(0,255,0,0.1)] border-primary/50",
        className
      )} 
      {...props}
    >
      {/* Hardware corners */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary pointer-events-none z-10" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-primary pointer-events-none z-10" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-primary pointer-events-none z-10" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary pointer-events-none z-10" />

      {/* Header */}
      {(title || icon || action) && (
        <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/20 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-xs">
            {icon && <span className="opacity-80">{icon}</span>}
            {title && <span>{title}</span>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative z-0">
        {/* Subtle grid background for content area */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
        {children}
      </div>
    </div>
  );
};
