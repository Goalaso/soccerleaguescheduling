import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/base.css';
import './styles/shared.css';
import './styles/teamGenerator.css';
import './styles/league.css';
import './styles/managePlayers.css';
import './styles/schedule.css';
import './styles/seasons.css';
import './styles/responsive.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

// Revisiting a page within staleTime shows cached data instantly with zero
// network request — the goal isn't just a snappier UI, it's fewer real
// queries hitting Neon's free-tier compute (which bills/suspends based on
// active time). refetchOnWindowFocus is off for the same reason: alt-tabbing
// back to the app shouldn't itself trigger a fresh query. Data that actually
// changes is kept correct via explicit invalidateQueries calls after each
// mutation (publish teams, record a result, mark availability, etc.), not by
// polling or a short staleTime — so staleTime itself can be generous
// (5 minutes) without a correctness cost; it only controls how long a normal
// multi-page browsing session (e.g. standings -> schedule) stays instant
// before falling back to a real fetch.
// A 4xx (bad request, not authenticated, not found, ...) means the request
// itself is wrong or the resource genuinely doesn't exist — retrying it
// changes nothing and just wastes ~1s of backoff delay on every single
// mount, forever (e.g. an admin account has no linked player row, so
// /players/me 404s every time, not just once). Only retry errors a second
// attempt could plausibly fix — a transient network blip or a real server
// error.
function shouldRetry(failureCount, error) {
  if (error?.status && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
