import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PlayerFormFields from './PlayerFormFields';
import PlayerAddedModal from './PlayerAddedModal';

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
  const { id } = useParams();
  const isEdit = !!id;
  const existing = isEdit ? players.find((p) => String(p.id) === id) : null;

  const [values, setValues] = useState(EMPTY_VALUES);
  const [leagueIds, setLeagueIds] = useState([]);
  const [error, setError] = useState(null);
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
        setAddedPlayer(player);
      }
    } catch (err) {
      setError(err.message);
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

      {error && <p className="options-warning">{error}</p>}

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
