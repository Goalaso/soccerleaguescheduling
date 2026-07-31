import React from 'react';
import { useSelectedSeason } from '../context/SelectedSeasonContext';

function SeasonSelector() {
  const {
    leagues,
    selectedLeagueId,
    setSelectedLeagueId,
    seasons,
    selectedSeasonId,
    setSelectedSeasonId,
    loading,
  } = useSelectedSeason();

  if (loading && leagues.length === 0) return null;

  return (
    <div className="season-selector">
      <select
        className="select-input"
        value={selectedLeagueId ?? ''}
        onChange={(e) => setSelectedLeagueId(Number(e.target.value))}
      >
        {leagues.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <select
        className="select-input"
        value={selectedSeasonId ?? ''}
        onChange={(e) => setSelectedSeasonId(Number(e.target.value))}
        disabled={seasons.length === 0}
      >
        {seasons.length === 0 ? (
          <option value="">No seasons yet</option>
        ) : (
          seasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}

export default SeasonSelector;
