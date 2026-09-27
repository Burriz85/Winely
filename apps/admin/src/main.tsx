import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CONFIG_OK } from './supabase';
import './styles.css';

class Crash extends Component<{ children: ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    return this.state.err
      ? <p style={{ padding: 24, color: 'var(--red)' }}>Noe gikk galt: {this.state.err.message}</p>
      : this.props.children;
  }
}

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
    {CONFIG_OK ? (
      <QueryClientProvider client={qc}><App /></QueryClientProvider>
    ) : (
      <p style={{ padding: 24, color: 'var(--red)' }}>Mangler VITE_SUPABASE_URL eller VITE_SUPABASE_ANON_KEY da siden ble bygget. Legg dem inn i Netlify (Environment variables) og bygg på nytt (Trigger deploy).</p>
    )}
    </Crash>
  </StrictMode>,
);
