import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/format';

export function LoginPage() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/pools';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (admin) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'background.default', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 400 }} variant="outlined">
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>License Manager</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in as an enterprise administrator
          </Typography>
          <Stack component="form" spacing={2} onSubmit={onSubmit} noValidate>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoFocus fullWidth />
            <TextField label="Password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required fullWidth />
            <Button type="submit" variant="contained" size="large" disabled={submitting || !email || !password}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
