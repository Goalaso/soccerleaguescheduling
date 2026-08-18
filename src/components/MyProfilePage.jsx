import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner';
import PlayerFormFields from './managePlayers/PlayerFormFields';
import ConfirmPasswordModal from './ConfirmPasswordModal';
import { useAuth } from '../context/AuthContext';
import { useMyProfile } from '../hooks/useMyProfile';
import { useLeagues } from '../hooks/useLeagues';

const EMPTY_VALUES = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  age: '',
  gender: '',
  position: '',
  skill: null,
  yearsExperience: '',
};

function AccountSettingsPanel() {
  const navigate = useNavigate();
  const { user, updateAccount, updatePreferences, deleteAccount } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [prefBusy, setPrefBusy] = useState(false);

  const handleToggleEmailNotifications = async () => {
    setPrefBusy(true);
    try {
      await updatePreferences({ emailNotificationsEnabled: !user.emailNotificationsEnabled });
    } finally {
      setPrefBusy(false);
    }
  };

  const handleDeleteAccount = async (password) => {
    await deleteAccount(password);
    navigate('/login', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!currentPassword) {
      setError('Enter your current password to save changes.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    const emailChanged = email !== user.email;
    if (!emailChanged && !newPassword) {
      setError('Change your email or enter a new password before saving.');
      return;
    }

    setSubmitting(true);
    try {
      await updateAccount({
        email: emailChanged ? email : undefined,
        password: newPassword || undefined,
        currentPassword,
      });
      setSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel auth-panel account-settings-panel">
      <h3 className="panel-title">Account Settings</h3>
      <form onSubmit={handleSubmit}>
        <div className="option-group">
          <span className="option-label">Email</span>
          <input
            className="select-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="player-form-row">
          <div className="option-group">
            <span className="option-label">New Password</span>
            <input
              className="select-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              minLength={8}
            />
          </div>
          <div className="option-group">
            <span className="option-label">Confirm New Password</span>
            <input
              className="select-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
            />
          </div>
        </div>

        <div className="option-group">
          <span className="option-label">Current Password (required to save)</span>
          <input
            className="select-input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        {error && <p className="options-warning">{error}</p>}
        {saved && !error && <p className="save-confirmation">Saved!</p>}

        <button className="pill-btn pill-btn-blue full-width" disabled={submitting}>
          {submitting ? 'Saving...' : 'Update Account'}
        </button>
      </form>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={!!user?.emailNotificationsEnabled}
          disabled={prefBusy}
          onChange={handleToggleEmailNotifications}
        />
        <span>
          <span className="checkbox-title">Email me important notifications</span>
        </span>
      </label>

      {user?.role === 'player' && (
        <div className="danger-zone">
          <span className="option-label">Danger Zone</span>
          <button
            type="button"
            className="outline-btn danger-outline-btn full-width"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete My Account
          </button>
        </div>
      )}

      {confirmingDelete && (
        <ConfirmPasswordModal
          title="Delete My Account"
          description="This permanently deletes your account and login access. Your player profile, team roster spot, and match history stay intact — you'd need a new account to log back in and manage them. This cannot be undone."
          confirmLabel="Delete My Account"
          onConfirm={handleDeleteAccount}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

function PlayerProfilePanel() {
  const { profile, loading, error: fetchError, updateProfile } = useMyProfile();
  const { leagues } = useLeagues();

  const [values, setValues] = useState(EMPTY_VALUES);
  const [leagueIds, setLeagueIds] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateValue = (field, val) => {
    setSaved(false);
    setValues((prev) => ({ ...prev, [field]: val }));
  };
  const toggleLeague = (leagueId) => {
    setSaved(false);
    setLeagueIds((prev) =>
      prev.includes(leagueId) ? prev.filter((l) => l !== leagueId) : [...prev, leagueId]
    );
  };

  useEffect(() => {
    if (!profile) return;
    const [first, ...rest] = profile.name.split(' ');
    setValues({
      firstName: first || '',
      lastName: rest.join(' '),
      email: profile.email || '',
      phone: profile.phone || '',
      age: profile.age ?? '',
      gender: profile.gender || '',
      position: profile.position || '',
      skill: profile.skill ?? null,
      yearsExperience: profile.yearsExperience ?? '',
    });
    setLeagueIds((profile.leagues || []).map((l) => l.id));
  }, [profile]);

  if (loading) {
    return <p className="auth-loading">Loading player profile...</p>;
  }

  if (fetchError || !profile) {
    return (
      <div className="panel empty-state">
        <p className="empty-state-title">No player profile linked</p>
        <p className="empty-state-subtitle">
          This account isn't associated with a player roster entry.
        </p>
      </div>
    );
  }

  const handleSubmit = async () => {
    setError(null);
    setSaved(false);
    const { firstName, lastName, email, position, skill, age } = values;
    if (!firstName || !lastName || !email || !position || !skill || !age) {
      setError('Please fill in all required fields.');
      return;
    }
    if (leagueIds.length === 0) {
      setError('Select at least one league.');
      return;
    }

    setSubmitting(true);
    try {
      await updateProfile({
        name: `${firstName} ${lastName}`.trim(),
        email: values.email,
        phone: values.phone || null,
        age: Number(values.age),
        gender: values.gender || null,
        position: values.position,
        skill: Number(values.skill),
        yearsExperience: values.yearsExperience ? Number(values.yearsExperience) : null,
        leagueIds,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="notify-breadcrumb">
        <span className="notify-breadcrumb-title">Player Profile</span>
        <span className="generated-subtitle">Monday Night League · Winter 2026</span>
        <button
          className="pill-btn pill-btn-blue notify-send-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && <p className="options-warning">{error}</p>}
      {saved && !error && <p className="save-confirmation">Saved!</p>}

      <PlayerFormFields
        values={values}
        onChange={updateValue}
        leagues={leagues}
        leagueIds={leagueIds}
        onToggleLeague={toggleLeague}
      />
    </>
  );
}

function MyProfilePage() {
  const navigate = useNavigate();

  return (
    <>
      <PageBanner
        title="My Profile"
        subtitle="Manage your account and player information"
        actionLabel="< Back to Home"
        onAction={() => navigate('/')}
      />
      <div className="generator-content">
        <AccountSettingsPanel />
        <div className="league-section">
          <PlayerProfilePanel />
        </div>
      </div>
    </>
  );
}

export default MyProfilePage;
