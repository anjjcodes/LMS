import { useState } from 'react';
import {
  Alert, Box, Breadcrumbs, Card, CardContent, CircularProgress, Link, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router-dom';
import type { PoolDto, SeatDto } from '@lms/shared';
import { lmsApi } from '../api/lms';
import { useAuth } from '../auth/AuthContext';
import { AssignSeatForm } from '../components/AssignSeatForm';
import { AuditTable } from '../components/AuditTable';
import { PoolStatusChip } from '../components/PoolStatusChip';
import { RevokeSeatDialog } from '../components/RevokeSeatDialog';
import { SeatsTable } from '../components/SeatsTable';
import { UsageBar } from '../components/UsageBar';
import { errorMessage } from '../lib/format';

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card variant="outlined" sx={{ flex: 1 }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function assignBlockedReason(pool: PoolDto): string | undefined {
  if (pool.status === 'SCHEDULED') return `This pool becomes active on ${pool.startDate}. Seats cannot be assigned yet.`;
  if (pool.status === 'EXPIRED') return `This pool expired on ${pool.endDate}. Seats cannot be assigned.`;
  if (pool.availableSeats === 0) return 'All seats are in use. Revoke a seat to free one up.';
  return undefined;
}

export function PoolDetailPage() {
  const { poolId = '' } = useParams();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'seats' | 'audit'>('seats');
  const [revoking, setRevoking] = useState<SeatDto | null>(null);

  const poolQuery = useQuery({ queryKey: ['pool', poolId], queryFn: () => lmsApi.getPool(poolId) });

  /** Seat counts may change from our action OR a concurrent admin → refetch everything for this pool. */
  const refresh = () => {
    for (const key of [['pool', poolId], ['seats', poolId], ['audit', poolId], ['pools']]) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  if (poolQuery.isPending) return <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>;
  if (poolQuery.isError) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{errorMessage(poolQuery.error)}</Alert>
        <Link component={RouterLink} to="/pools">← Back to pools</Link>
      </Stack>
    );
  }
  const pool = poolQuery.data;

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/pools" underline="hover" color="inherit">Pools</Link>
        <Typography color="text.primary">{pool.name}</Typography>
      </Breadcrumbs>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>{pool.name}</Typography>
            <PoolStatusChip status={pool.status} />
          </Stack>
          <Typography color="text.secondary">
            Valid {pool.startDate} → {pool.endDate} (UTC, inclusive)
          </Typography>
        </Box>
        <Box sx={{ width: { xs: '100%', sm: 260 } }}>
          <UsageBar used={pool.activeSeats} capacity={pool.capacity} />
        </Box>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Stat label="Purchased seats" value={pool.capacity} />
        <Stat label="Assigned" value={pool.activeSeats} />
        <Stat label="Available" value={pool.availableSeats} />
      </Stack>

      {isAdmin && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Assign a seat</Typography>
            <AssignSeatForm poolId={pool.id} disabledReason={assignBlockedReason(pool)} onAssigned={refresh} onConflict={refresh} />
          </CardContent>
        </Card>
      )}

      <Card variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="seats" label="Seats" />
          <Tab value="audit" label="Audit history" />
        </Tabs>
        <CardContent>
          {tab === 'seats'
            ? <SeatsTable poolId={pool.id} canRevoke={isAdmin} onRevoke={setRevoking} />
            : <AuditTable poolId={pool.id} />}
        </CardContent>
      </Card>

      <RevokeSeatDialog seat={revoking} onClose={() => setRevoking(null)} onDone={() => { setRevoking(null); refresh(); }} onRefresh={refresh} />
    </Stack>
  );
}
