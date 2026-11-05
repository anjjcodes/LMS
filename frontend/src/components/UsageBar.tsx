import { Box, LinearProgress, Typography } from '@mui/material';

export function UsageBar({ used, capacity }: { used: number; capacity: number }) {
  const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
  const color = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'primary';
  return (
    <Box sx={{ minWidth: 140 }}>
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <strong>{used}</strong> / {capacity} used
      </Typography>
      <LinearProgress variant="determinate" value={Math.min(pct, 100)} color={color} sx={{ height: 6, borderRadius: 3 }} />
    </Box>
  );
}
