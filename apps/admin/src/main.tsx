import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SUPABASE_URL } from './supabase';
import './styles.css';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {SUPABASE_URL ? (
      <QueryClientProvider client={qc}><App /></QueryClientProvider>
    ) : (
      <p style={{ padding: 24, color: 'var(--red)' }}>Mangler VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY. Se apps/admin/.env.example.</p>
    )}
  </StrictMode>,
);
