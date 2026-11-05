import { useState } from 'react';
import {
  Alert, Box, Button, Card, CircularProgress, Stack, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Typography,
} from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { PoolStatus } from '@lms/shared';
import { lmsApi } from '../api/lms';
import { useAuth } from '../auth/AuthContext';
import { CreatePoolDialog } from '../components/CreatePoolDialog';
import { PoolStatusChip } from '../components/PoolStatusChip';
import { UsageBar } from '../components/UsageBar';
import { errorMessage } from '../lib/format';

type Filter = 'ALL' | PoolStatus;

export function PoolsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [createOpen, setCreateOpen] = useState(false);

  const query = useInfiniteQuery({
    queryKey: ['pools', filter],
    queryFn: ({ pageParam }) =>
      lmsApi.listPools({ status: filter === 'ALL' ? undefined : filter, cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const pools = query.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>License pools</Typography>
          <Typography color="text.secondary">Purchased seat pools and their current usage</Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" onClick={() => setCreateOpen(true)}>New pool</Button>
        )}
      </Stack>

      <Card variant="outlined">
        <Tabs value={filter} onChange={(_, v: Filter) => setFilter(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab value="ALL" label="All" />
          <Tab value="ACTIVE" label="Active" />
          <Tab value="SCHEDULED" label="Scheduled" />
          <Tab value="EXPIRED" label="Expired" />
        </Tabs>

        {query.isError && <Alert severity="error" sx={{ m: 2 }}>{errorMessage(query.error)}</Alert>}
        {query.isPending ? (
          <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
        ) : pools.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No pools here yet.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Usage</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Valid from</TableCell>
                  <TableCell>Valid until</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pools.map((p) => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/pools/${p.id}`)}>
                    <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                    <TableCell><PoolStatusChip status={p.status} /></TableCell>
                    <TableCell><UsageBar used={p.activeSeats} capacity={p.capacity} /></TableCell>
                    <TableCell>{p.availableSeats}</TableCell>
                    <TableCell>{p.startDate}</TableCell>
                    <TableCell>{p.endDate}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {query.hasNextPage && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Button onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </Box>
        )}
      </Card>

      <CreatePoolDialog open={createOpen} onClose={() => setCreateOpen(false)}
        onCreated={(pool) => { setCreateOpen(false); navigate(`/pools/${pool.id}`); }} />
    </Stack>
  );
}
