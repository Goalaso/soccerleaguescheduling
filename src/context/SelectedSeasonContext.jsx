import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLeagues } from '../hooks/useLeagues';
import { useSeasons } from '../hooks/useSeasons';

const SelectedSeasonContext = createContext(null);

// Shared across LeaguePage and SchedulePage (both mounted once under App,
// so this Provider's state survives navigating between them) — picking a
// league/season in one keeps it selected when you switch to the other.
export function SelectedSeasonProvider({ children }) {
  const { leagues, loading: leaguesLoading } = useLeagues();
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);

  useEffect(() => {
    if (leaguesLoading || selectedLeagueId != null || leagues.length === 0) return;
    setSelectedLeagueId(leagues[0].id);
  }, [leaguesLoading, leagues, selectedLeagueId]);

  const { seasons, loading: seasonsLoading } = useSeasons(selectedLeagueId);
  const browsableSeasons = useMemo(
    () => seasons.filter((s) => s.status === 'teams_generated'),
    [seasons]
  );

  useEffect(() => {
    if (seasonsLoading) return;
    // Default to the most recent season with teams whenever the league
    // changes (or the currently selected season no longer belongs to it).
    const stillValid = browsableSeasons.some((s) => s.id === selectedSeasonId);
    if (!stillValid) {
      setSelectedSeasonId(browsableSeasons[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueId, seasonsLoading, browsableSeasons]);

  const selectedSeason = browsableSeasons.find((s) => s.id === selectedSeasonId) || null;

  const value = {
    leagues,
    selectedLeagueId,
    setSelectedLeagueId,
    seasons: browsableSeasons,
    selectedSeasonId,
    setSelectedSeasonId,
    selectedSeason,
    loading: leaguesLoading || seasonsLoading,
  };

  return <SelectedSeasonContext.Provider value={value}>{children}</SelectedSeasonContext.Provider>;
}

export function useSelectedSeason() {
  const ctx = useContext(SelectedSeasonContext);
  if (!ctx) throw new Error('useSelectedSeason must be used within SelectedSeasonProvider');
  return ctx;
}
