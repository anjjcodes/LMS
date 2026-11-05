import { useState, type FormEvent } from 'react';
import { Alert, Button, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import type { SeatMutationResponse } from '@lms/shared';
import { lmsApi } from '../api/lms';
import { errorMessage } from '../lib/format';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  poolId: string;
  disabledReason?: string;
  onAssigned: (seat: SeatMutationResponse) => void;
  onConflict: () => void;
}

export function AssignSeatForm({ poolId, disabledReason, onAssigned, onConflict }: Props) {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (value: string) => lmsApi.assignSeat(poolId, value),
    onSuccess: (seat) => {
      setSuccess(`Seat assigned to ${seat.employeeEmail}`);
      setEmail('');
      onAssigned(seat);
    },
    // Even on failure, counts may have changed (e.g. another admin took the last seat) → refresh.
    onError: () => onConflict(),
  });

  const trimmed = email.trim();
  const invalid = trimmed.length > 0 && !EMAIL_RE.test(trimmed);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(null);
    if (trimmed && !invalid) mutation.mutate(trimmed);
  }

  return (
    <Stack spacing={1.5}>
      {disabledReason && <Alert severity="info">{disabledReason}</Alert>}
      {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
      {success && !mutation.isError && <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert>}
      <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} onSubmit={onSubmit} noValidate>
        <TextField label="Employee email" type="email" size="small" value={email} fullWidth
          onChange={(e) => { setEmail(e.target.value); setSuccess(null); }}
          error={invalid} helperText={invalid ? 'Enter a valid email address' : undefined}
          disabled={!!disabledReason} />
        <Button type="submit" variant="contained" sx={{ whiteSpace: 'nowrap', minWidth: 140 }}
          disabled={!!disabledReason || !trimmed || invalid || mutation.isPending}>
          {mutation.isPending ? 'Assigning…' : 'Assign seat'}
        </Button>
      </Stack>
    </Stack>
  );
}
