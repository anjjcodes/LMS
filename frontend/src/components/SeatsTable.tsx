import { useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { SeatDto, SeatStatus } from '@lms/shared';
import { lmsApi } from '../api/lms';
import { errorMessage, formatDateTime } from '../lib/format';

interface Props {
  poolId: string;
  canRevoke: boolean;
  onRevoke: (seat: SeatDto) => void;
}

export function SeatsTable({ poolId, canRevoke, onRevoke }: Props) {
  const [status, setStatus] = useState<SeatStatus | 'ALL'>('ACTIVE');
  const query = useInfiniteQuery({
    queryKey: ['seats', poolId, status],
    queryFn: ({ pageParam }) =>
      lmsApi.listSeats(poolId, { status: status === 'ALL' ? undefined : status, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const seats = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v) => v && setStatus(v)}>
        <ToggleButton value="ACTIVE">Active</ToggleButton>
        <ToggleButton value="REVOKED">Revoked</ToggleButton>
        <ToggleButton value="ALL">All</ToggleButton>
      </ToggleButtonGroup>

      {query.isError && <Alert severity="error">{errorMessage(query.error)}</Alert>}
      {query.isPending ? (
        <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={28} /></Box>
      ) : seats.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 2 }}>No seats to show.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Assigned</TableCell>
                <TableCell>Revoked</TableCell>
                {canRevoke && <TableCell align="right" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {seats.map((s) => (
                <TableRow key={s.id}>
                  <TableCell sx={{ fontWeight: 500 }}>{s.employeeEmail}</TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status === 'ACTIVE' ? 'Active' : 'Revoked'}
                      color={s.status === 'ACTIVE' ? 'success' : 'default'} variant={s.status === 'ACTIVE' ? 'filled' : 'outlined'} />
                  </TableCell>
                  <TableCell>{formatDateTime(s.assignedAt)}</TableCell>
                  <TableCell>{s.revokedAt ? formatDateTime(s.revokedAt) : '—'}</TableCell>
                  {canRevoke && (
                    <TableCell align="right">
                      {s.status === 'ACTIVE' && (
                        <Button size="small" color="error" onClick={() => onRevoke(s)}>Revoke</Button>
                      )}
                    </TableCell>
                  )}
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
