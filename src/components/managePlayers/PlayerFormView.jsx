import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PlayerFormFields from './PlayerFormFields';
import PlayerAddedModal from './PlayerAddedModal';
import { useWaitlist } from '../../hooks/useWaitlist';

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

function PlayerFormView({ players, leagues, createPlayer, updatePlayer }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { entries: waitlistEntries, approve } = useWaitlist();
  const isEdit = !!id;
  const existing = isEdit ? players.find((p) => String(p.id) === id) : null;
  // Arriving from the waitlist review queue pre-fills the email and, once
  // the player's actually created below, resolves that pending entry —
  // approving means "someone created a player from this," not a separate click.
  const waitlistId = searchParams.get('waitlistId');
  // Prefer the entry passed directly via navigation state (no extra fetch,
  // and still there even after it's approved) — fall back to the pending
  // list for a direct link/refresh where that state is gone.
  const waitlistEntry =
    location.state?.waitlistEntry || waitlistEntries.find((e) => String(e.id) === waitlistId) || null;

  const [values, setValues] = useState(() => ({
    ...EMPTY_VALUES,
    email: searchParams.get('email') || '',
  }));
  const [leagueIds, setLeagueIds] = useState([]);
  const [error, setError] = useState(null);
  const [duplicatePlayerId, setDuplicatePlayerId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [addedPlayer, setAddedPlayer] = useState(null);

  const updateValue = (field, val) => setValues((prev) => ({ ...prev, [field]: val }));
  const toggleLeague = (leagueId) =>
    setLeagueIds((prev) =>
      prev.includes(leagueId) ? prev.filter((l) => l !== leagueId) : [...prev, leagueId]
    );

  useEffect(() => {
    if (!existing) return;
    const [first, ...rest] = existing.name.split(' ');
    setValues({
      firstName: first || '',
      lastName: rest.join(' '),
      email: existing.email || '',
      phone: existing.phone || '',
      age: existing.age ?? '',
      gender: existing.gender || '',
      position: existing.position || '',
      skill: existing.skill ?? null,
      yearsExperience: existing.yearsExperience ?? '',
    });
    setLeagueIds((existing.leagues || []).map((l) => l.id));
  }, [existing]);

  const resetForm = () => {
    setValues(EMPTY_VALUES);
    setLeagueIds([]);
  };

  const handleSubmit = async () => {
    setError(null);
    setDuplicatePlayerId(null);
    const { firstName, lastName, email, position, skill, age, phone, gender, yearsExperience } = values;
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
      const payload = {
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone: phone || null,
        age: Number(age),
        gender: gender || null,
        position,
        skill: Number(skill),
        yearsExperience: yearsExperience ? Number(yearsExperience) : null,
        leagueIds,
      };

      if (isEdit) {
        await updatePlayer(existing.id, payload);
        navigate('/players');
      } else {
        const player = await createPlayer(payload);
        if (waitlistId) await approve(waitlistId);
        setAddedPlayer(player);
      }
    } catch (err) {
      setError(err.message);
      setDuplicatePlayerId(err.data?.existingPlayerId || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={() => navigate('/players')}>
          &lt; Manage Players
        </button>
        <span className="notify-breadcrumb-title">
          {isEdit ? 'Edit Player' : 'Add New Player'}
        </span>
        <span className="generated-subtitle">Monday Night League · Winter 2026</span>
        <button
          className="pill-btn pill-btn-blue notify-send-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {isEdit ? 'Save Changes' : 'Add Player'} &rarr;
        </button>
      </div>

      {error && (
        <p className="options-warning">
          {error}
          {duplicatePlayerId && (
            <>
              {' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => navigate(`/players/edit/${duplicatePlayerId}`)}
              >
                Edit that player instead &gt;
              </button>
            </>
          )}
        </p>
      )}

      {waitlistEntry && (waitlistEntry.rawSubject || waitlistEntry.rawSnippet) && (
        <div className="panel waitlist-message-panel">
          <span className="option-label">Their message</span>
          {waitlistEntry.rawSubject && <p className="waitlist-message-subject">{waitlistEntry.rawSubject}</p>}
          {waitlistEntry.rawSnippet && <p className="waitlist-message-snippet">{waitlistEntry.rawSnippet}</p>}
        </div>
      )}

      <PlayerFormFields
        values={values}
        onChange={updateValue}
        leagues={leagues}
        leagueIds={leagueIds}
        onToggleLeague={toggleLeague}
      />

      {addedPlayer && (
        <PlayerAddedModal
          player={addedPlayer}
          onAddAnother={() => {
            setAddedPlayer(null);
            resetForm();
          }}
          onBackToList={() => navigate('/players')}
        />
      )}
    </div>
  );
}

export default PlayerFormView;
