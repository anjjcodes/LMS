import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import type { SeatDto } from '@lms/shared';
import { lmsApi } from '../api/lms';
import { errorMessage } from '../lib/format';

interface Props {
  seat: SeatDto | null;
  onClose: () => void;
  onDone: () => void;
  /** Refresh data without closing (keeps the error visible). */
  onRefresh: () => void;
}

export function RevokeSeatDialog({ seat, onClose, onDone, onRefresh }: Props) {
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: (s: SeatDto) => lmsApi.revokeSeat(s.poolId, s.id, reason.trim() || undefined),
    onSuccess: () => { setReason(''); onDone(); },
    onError: () => onRefresh(), // another admin may have revoked it already
  });

  const close = () => { setReason(''); mutation.reset(); onClose(); };

  return (
    <Dialog open={!!seat} onClose={close} fullWidth maxWidth="xs">
      <DialogTitle>Revoke seat</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Revoke the license held by <strong>{seat?.employeeEmail}</strong>? The seat returns to the pool and
          the employee immediately stops verifying as licensed.
        </DialogContentText>
        {mutation.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(mutation.error)}</Alert>}
        <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)}
          fullWidth multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close}>Cancel</Button>
        <Button color="error" variant="contained" disabled={mutation.isPending || mutation.isError}
          onClick={() => seat && mutation.mutate(seat)}>
          {mutation.isPending ? 'Revoking…' : 'Revoke'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
