import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './components/HomePage';
import SeasonsPage from './components/SeasonsPage';
import LeaguePage from './components/LeaguePage';
import SchedulePage from './components/SchedulePage';
import ManagePlayersPage from './components/ManagePlayersPage';
import MyProfilePage from './components/MyProfilePage';
import AuthPage from './components/AuthPage';
import RequireAuth from './components/RequireAuth';
import { SelectedSeasonProvider } from './context/SelectedSeasonContext';

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />

      <main className="main-content">
        <SelectedSeasonProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/schedule/*"
              element={
                <RequireAuth>
                  <SchedulePage />
                </RequireAuth>
              }
            />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <MyProfilePage />
                </RequireAuth>
              }
            />
            <Route
              path="/players/*"
              element={
                <RequireAuth role="admin">
                  <ManagePlayersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/seasons/*"
              element={
                <RequireAuth role="admin">
                  <SeasonsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/league/*"
              element={
                <RequireAuth>
                  <LeaguePage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SelectedSeasonProvider>
      </main>
    </div>
  );
}

export default App;
