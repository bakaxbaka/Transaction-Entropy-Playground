import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Filter, AlertTriangle, Key, Activity, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TerminalModule } from './terminal-module';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'api' | 'keygen';
}

interface SystemLogProps {
  logs: LogEntry[];
  className?: string;
}

export const SystemLog = ({ logs, className }: SystemLogProps) => {
  const [filter, setFilter] = useState<'all' | 'warning' | 'api' | 'keygen'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, filter]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'warning') return log.type === 'warning' || log.type === 'error';
    return log.type === filter;
  });

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-destructive';
      case 'warning': return 'text-amber-500';
      case 'success': return 'text-green-400';
      case 'api': return 'text-cyan-400';
      case 'keygen': return 'text-purple-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <TerminalModule 
      title="System Log" 
      icon={<Terminal className="w-4 h-4" />}
      className={className}
      action={
        <div className="flex gap-1">
          {['all', 'warning', 'api', 'keygen'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={cn(
                "px-2 py-0.5 text-[10px] uppercase border transition-colors",
                filter === f 
                  ? "border-primary bg-primary/20 text-primary" 
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-full overflow-y-auto p-2 font-mono text-[10px] space-y-1">
        {filteredLogs.length === 0 && (
          <div className="text-muted-foreground/50 italic p-2">No logs matching filter...</div>
        )}
        {filteredLogs.map((log) => (
          <div key={log.id} className="flex gap-2 hover:bg-white/5 p-0.5 rounded">
            <span className="text-muted-foreground/60 whitespace-nowrap">[{log.timestamp}]</span>
            <span className={cn("break-all", getLogColor(log.type))}>
              {log.type === 'api' && <Activity className="inline w-3 h-3 mr-1" />}
              {log.type === 'keygen' && <Key className="inline w-3 h-3 mr-1" />}
              {log.type === 'warning' && <AlertTriangle className="inline w-3 h-3 mr-1" />}
              {log.type === 'success' && <CheckCircle className="inline w-3 h-3 mr-1" />}
              {log.message}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1 text-primary animate-pulse mt-2">
          <span>{'>'}</span>
          <span className="w-2 h-4 bg-primary/50 block"></span>
        </div>
        <div ref={bottomRef} />
      </div>
    </TerminalModule>
  );
};
