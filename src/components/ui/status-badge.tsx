import {
  Clock,
  Download,
  Brain,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditStatus } from '@/types';
import { STATUS_CONFIG } from '@/lib/constants';

const statusIcons: Record<AuditStatus, React.ElementType> = {
  pending: Clock,
  collecting: Download,
  analyzing: Brain,
  complete: CheckCircle2,
  failed: XCircle,
};

interface StatusBadgeProps {
  status: AuditStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = statusIcons[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
        config.bgColor,
        config.color,
        config.pulse && 'animate-status-pulse',
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
