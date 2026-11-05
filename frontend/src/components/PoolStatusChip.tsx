import { Chip } from '@mui/material';
import type { PoolStatus } from '@lms/shared';

const CONFIG: Record<PoolStatus, { label: string; color: 'success' | 'info' | 'default' }> = {
  ACTIVE: { label: 'Active', color: 'success' },
  SCHEDULED: { label: 'Scheduled', color: 'info' },
  EXPIRED: { label: 'Expired', color: 'default' },
};

export function PoolStatusChip({ status }: { status: PoolStatus }) {
  const c = CONFIG[status];
  return <Chip size="small" label={c.label} color={c.color} variant={status === 'EXPIRED' ? 'outlined' : 'filled'} />;
}
