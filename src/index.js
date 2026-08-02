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
// polling or a short staleTime.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
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
