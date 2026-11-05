import { AppBar, Box, Button, Chip, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Layout() {
  const { admin, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} color="inherit" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" component={RouterLink} to="/pools" sx={{ color: 'text.primary', textDecoration: 'none', fontWeight: 700 }}>
            License Manager
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexGrow: 1 }}>
            <Button component={RouterLink} to="/pools" color={pathname.startsWith('/pools') ? 'primary' : 'inherit'}>
              Pools
            </Button>
            <Button component={RouterLink} to="/verify" color={pathname === '/verify' ? 'primary' : 'inherit'}>
              Verify (SaaS simulator)
            </Button>
          </Stack>
          {admin && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {admin.email}
              </Typography>
              <Chip size="small" label={admin.role === 'ORG_ADMIN' ? 'Admin' : 'Viewer'} color={admin.role === 'ORG_ADMIN' ? 'primary' : 'default'} />
              <Button size="small" variant="outlined" onClick={logout}>
                Sign out
              </Button>
            </Stack>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
