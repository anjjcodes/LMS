import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { lmsApi } from '../api/lms';
import { errorMessage, formatDateTime } from '../lib/format';

/**
 * Simulates the SaaS application's call. It deliberately does NOT use the admin session:
 * verification authenticates with the SaaS API key only, exactly as the real product would.
 */
export function VerifyPage() {
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const mutation = useMutation({ mutationFn: () => lmsApi.verify(apiKey.trim(), email.trim()) });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (apiKey.trim() && email.trim()) mutation.mutate();
  }

  const result = mutation.data;

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Verify license</Typography>
        <Typography color="text.secondary">
          Simulates the SaaS application calling <code>POST /api/v1/licenses/verify</code> with its API key.
        </Typography>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
            <TextField label="SaaS API key (X-API-Key)" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              type="password" autoComplete="off" fullWidth helperText="For the seeded dev data, see SEED_API_KEY in backend/.env" />
            <TextField label="Employee email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            <Button type="submit" variant="contained" disabled={!apiKey.trim() || !email.trim() || mutation.isPending}>
              {mutation.isPending ? 'Checking…' : 'Verify'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {mutation.isError && <Alert severity="error">{errorMessage(mutation.error)}</Alert>}
      {result && (
        result.licensed ? (
          <Alert severity="success" variant="outlined">
            <strong>{result.email}</strong> holds a valid license (valid until {result.validUntil}).
            <Typography variant="caption" sx={{ display: 'block' }}>Checked {formatDateTime(result.checkedAt)}</Typography>
          </Alert>
        ) : (
          <Alert severity="warning" variant="outlined">
            <strong>{result.email}</strong> is NOT licensed ({result.reason}).
            <Typography variant="caption" sx={{ display: 'block' }}>Checked {formatDateTime(result.checkedAt)}</Typography>
          </Alert>
        )
      )}
    </Stack>
  );
}
