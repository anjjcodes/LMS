import { useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PoolDto } from '@lms/shared';
import { lmsApi } from '../api/lms';
import { errorMessage, utcDatePlusDays, utcToday } from '../lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (pool: PoolDto) => void;
}

export function CreatePoolDialog({ open, onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [startDate, setStartDate] = useState(utcToday());
  const [endDate, setEndDate] = useState(utcDatePlusDays(365));

  const mutation = useMutation({
    mutationFn: () => lmsApi.createPool({ name: name.trim(), capacity: Number(capacity), startDate, endDate }),
    onSuccess: (pool) => {
      queryClient.invalidateQueries({ queryKey: ['pools'] });
      reset();
      onCreated(pool);
    },
  });

  function reset() {
    setName('');
    setCapacity('10');
    setStartDate(utcToday());
    setEndDate(utcDatePlusDays(365));
    mutation.reset();
  }

  const capacityNum = Number(capacity);
  const capacityInvalid = !Number.isInteger(capacityNum) || capacityNum < 1;
  const datesInvalid = !!startDate && !!endDate && endDate < startDate;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!capacityInvalid && !datesInvalid && name.trim()) mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} fullWidth maxWidth="sm">
      <form onSubmit={onSubmit} noValidate>
        <DialogTitle>Create license pool</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
            <TextField label="Pool name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus
              slotProps={{ htmlInput: { maxLength: 120 } }} />
            <TextField label="Seats (N)" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)}
              required error={capacityInvalid} helperText={capacityInvalid ? 'Must be a whole number ≥ 1' : ' '}
              slotProps={{ htmlInput: { min: 1, max: 1_000_000, step: 1 } }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Start date (UTC)" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                required fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="End date (UTC, inclusive)" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                required fullWidth error={datesInvalid} helperText={datesInvalid ? 'Must be on or after start date' : ' '}
                slotProps={{ inputLabel: { shrink: true } }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button type="submit" variant="contained"
            disabled={mutation.isPending || !name.trim() || capacityInvalid || datesInvalid || !startDate || !endDate}>
            {mutation.isPending ? 'Creating…' : 'Create pool'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
