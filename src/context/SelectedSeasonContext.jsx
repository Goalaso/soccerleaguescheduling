import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useLeagues } from '../hooks/useLeagues';
import { useSeasons } from '../hooks/useSeasons';

const SelectedSeasonContext = createContext(null);

// Shared across LeaguePage and SchedulePage (both mounted once under App,
// so this Provider's state survives navigating between them) — picking a
// league/season in one keeps it selected when you switch to the other.
export function SelectedSeasonProvider({ children }) {
  const { user } = useAuth();
  const { leagues, loading: leaguesLoading } = useLeagues();
  const [selectedLeagueId, setSelectedLeagueId] = useState(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);

  useEffect(() => {
    if (leaguesLoading || selectedLeagueId != null || leagues.length === 0) return;
    setSelectedLeagueId(leagues[0].id);
  }, [leaguesLoading, leagues, selectedLeagueId]);

  const { seasons, loading: seasonsLoading, error: seasonsError, refetch: refetchSeasons } = useSeasons(
    selectedLeagueId
  );

  // /api/seasons requires auth. This provider mounts app-wide, so it starts
  // fetching immediately — including before the user has logged in (e.g.
  // while still on /login), which 401s and leaves selectedSeasonId stuck at
  // null with nothing to retry it. Re-fetch whenever login completes — but
  // only if the earlier attempt actually failed; otherwise this fired an
  // unconditional, redundant second /seasons request on every single page
  // load, even ones with an already-valid session where the first request
  // succeeded fine (visible as a duplicate seasons?leagueId=X call).
  const wasLoggedIn = useRef(false);
  useEffect(() => {
    if (user && !wasLoggedIn.current && seasonsError) {
      refetchSeasons();
    }
    wasLoggedIn.current = !!user;
  }, [user, seasonsError, refetchSeasons]);

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

  // leaguesLoading/seasonsLoading alone miss a real gap: once a list finishes
  // loading, there's a render (or more) before the effects above actually
  // pick a default id. During that window selectedLeagueId/selectedSeasonId
  // are still null, but downstream queries gated on them (usePublishedTeams,
  // useMatches) are *disabled* rather than loading — a disabled query reports
  // isLoading:false, not true — so every loading flag a consumer checks can
  // read false at once with no real data resolved yet. Same class of bug as
  // the SchedulePage/CalendarView fix, one layer further upstream, shared by
  // every consumer of this context.
  const leaguePending = !leaguesLoading && leagues.length > 0 && selectedLeagueId == null;
  const seasonPending =
    !seasonsLoading && browsableSeasons.length > 0 && !browsableSeasons.some((s) => s.id === selectedSeasonId);

  const value = {
    leagues,
    selectedLeagueId,
    setSelectedLeagueId,
    seasons: browsableSeasons,
    selectedSeasonId,
    setSelectedSeasonId,
    selectedSeason,
    loading: leaguesLoading || leaguePending || seasonsLoading || seasonPending,
  };

  return <SelectedSeasonContext.Provider value={value}>{children}</SelectedSeasonContext.Provider>;
}

export function useSelectedSeason() {
  const ctx = useContext(SelectedSeasonContext);
  if (!ctx) throw new Error('useSelectedSeason must be used within SelectedSeasonProvider');
  return ctx;
}
