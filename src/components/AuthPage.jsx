import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLeagues } from '../hooks/useLeagues';
import { POSITIONS } from '../constants/positions';
import PageBanner from './PageBanner';

function AuthPage() {
  const { login, register, devLoginAsAdmin } = useAuth();
  const { leagues } = useLeagues();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [skill, setSkill] = useState('');
  const [age, setAge] = useState('');
  const [leagueIds, setLeagueIds] = useState([]);
  const [joinSeasonLeagueIds, setJoinSeasonLeagueIds] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleDevLoginAsAdmin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await devLoginAsAdmin();
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Checking a league that currently has a season forming defaults its
  // nested opt-in on too — visible and overridable, not a silent auto-add
  // (see project plan) — and unchecking the league drops the opt-in with it.
  const toggleLeague = (league) => {
    const isSelected = leagueIds.includes(league.id);
    setLeagueIds((prev) => (isSelected ? prev.filter((l) => l !== league.id) : [...prev, league.id]));
    setJoinSeasonLeagueIds((prev) => {
      if (isSelected) return prev.filter((l) => l !== league.id);
      return league.openSeasonId ? [...prev, league.id] : prev;
    });
  };

  const toggleJoinSeason = (leagueId) =>
    setJoinSeasonLeagueIds((prev) =>
      prev.includes(leagueId) ? prev.filter((l) => l !== leagueId) : [...prev, leagueId]
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && leagueIds.length === 0) {
      setError('Select at least one league.');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({
          email,
          password,
          name,
          position,
          skill: Number(skill),
          age: Number(age),
          leagueIds,
          joinSeasonLeagueIds,
        });
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageBanner
        title={mode === 'login' ? 'Log In' : 'Create Account'}
        subtitle="Boeing Indoor Soccer League"
      />
      <div className="generator-content auth-page-content">
        <div className="panel auth-panel">
          <div className="toggle-pair auth-mode-toggle">
            <button
              className={`toggle-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
              type="button"
            >
              Log In
            </button>
            <button
              className={`toggle-btn ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="option-group">
                <span className="option-label">Name</span>
                <input
                  className="select-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="option-group">
              <span className="option-label">Email</span>
              <input
                className="select-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="option-group">
              <span className="option-label">Password</span>
              <input
                className="select-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {mode === 'register' && (
              <div className="option-group">
                <span className="option-label">Confirm Password</span>
                <input
                  className="select-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
            )}

            {mode === 'register' && (
              <>
                <div className="option-group">
                  <span className="option-label">Preferred Position</span>
                  <select
                    className="select-input"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a position
                    </option>
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="option-group">
                  <span className="option-label">Skill Rating (1-10)</span>
                  <input
                    className="select-input"
                    type="number"
                    min={1}
                    max={10}
                    value={skill}
                    onChange={(e) => setSkill(e.target.value)}
                    required
                  />
                </div>

                <div className="option-group">
                  <span className="option-label">Age</span>
                  <input
                    className="select-input"
                    type="number"
                    min={1}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                  />
                </div>

                <div className="option-group">
                  <span className="option-label">Leagues (select at least one)</span>
                  {leagues.map((league) => (
                    <React.Fragment key={league.id}>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={leagueIds.includes(league.id)}
                          onChange={() => toggleLeague(league)}
                        />
                        <span>
                          <span className="checkbox-title">{league.name}</span>
                        </span>
                      </label>
                      {leagueIds.includes(league.id) && league.openSeasonId && (
                        <label className="checkbox-row join-season-row">
                          <input
                            type="checkbox"
                            checked={joinSeasonLeagueIds.includes(league.id)}
                            onChange={() => toggleJoinSeason(league.id)}
                          />
                          <span>
                            <span className="checkbox-title">
                              Also include me in "{league.openSeasonName}", forming now
                            </span>
                          </span>
                        </label>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}

            {error && <p className="options-warning">{error}</p>}

            <button className="pill-btn pill-btn-blue full-width" disabled={submitting}>
              {submitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          {mode === 'login' && (
            <button
              type="button"
              className="outline-btn full-width"
              style={{ marginTop: '0.75rem' }}
              onClick={handleDevLoginAsAdmin}
              disabled={submitting}
            >
              Login as Admin (dev preview)
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default AuthPage;
