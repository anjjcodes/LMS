import {
  Alert, Box, Button, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AuditAction } from '@lms/shared';
import { lmsApi } from '../api/lms';
import { errorMessage, formatDateTime } from '../lib/format';

const ACTION: Record<AuditAction, { label: string; color: 'primary' | 'error' | 'default' }> = {
  POOL_CREATED: { label: 'Pool created', color: 'default' },
  SEAT_ASSIGNED: { label: 'Assigned', color: 'primary' },
  SEAT_REVOKED: { label: 'Revoked', color: 'error' },
};

export function AuditTable({ poolId }: { poolId: string }) {
  const query = useInfiniteQuery({
    queryKey: ['audit', poolId],
    queryFn: ({ pageParam }) => lmsApi.listAudit(poolId, { cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const entries = query.data?.pages.flatMap((p) => p.data) ?? [];

  if (query.isPending) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>;

  return (
    <Stack spacing={2}>
      {query.isError && <Alert severity="error">{errorMessage(query.error)}</Alert>}
      {entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2 }}>No history yet.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Employee</TableCell>
                <TableCell>Performed by</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(e.occurredAt)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={ACTION[e.action].label} color={ACTION[e.action].color} variant="outlined" />
                  </TableCell>
                  <TableCell>{e.employeeEmail ?? '—'}</TableCell>
                  <TableCell>{e.actor.email}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {typeof e.metadata.reason === 'string' ? `Reason: ${e.metadata.reason}` : ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {query.hasNextPage && (
        <Button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
          {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </Stack>
  );
}
