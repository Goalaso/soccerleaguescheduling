import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner';
import SeasonSelector from './SeasonSelector';
import CalendarView from './schedule/CalendarView';
import RecordResultsView from './schedule/RecordResultsView';
import GameDayView from './schedule/GameDayView';
import LeagueEmptyState from './league/LeagueEmptyState';
import { usePublishedTeams } from '../hooks/usePublishedTeams';
import { useMatches } from '../hooks/useMatches';
import { useMyProfile } from '../hooks/useMyProfile';
import { useAuth } from '../context/AuthContext';
import { useSelectedSeason } from '../context/SelectedSeasonContext';

function SchedulePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { selectedSeasonId, loading: seasonLoading } = useSelectedSeason();
  const { teams, loading: teamsLoading } = usePublishedTeams(selectedSeasonId);
  const { matches, loading: matchesLoading, refetch } = useMatches(selectedSeasonId);
  // An admin has no linked player row — myTeam/filterTeamId are meaningless
  // for them anyway (showAll={isAdmin} already bypasses the filter below),
  // so skip the request entirely rather than let it 404 on every mount.
  const { profile, loading: profileLoading } = useMyProfile({ enabled: !isAdmin });

  const myTeam = teams?.find((t) => t.players.some((p) => p.id === profile?.id));

  // profileLoading has to be part of this gate — myTeam depends on profile,
  // and if profile resolves slower than the other three (real network
  // latency in production, rarely noticeable on localhost), the calendar
  // can render before it's ready and filter out every match for a
  // non-admin viewer, even though their data is actually fine. Disabled
  // (admin) counts as immediately "not loading," not stuck loading forever.
  const loading = seasonLoading || teamsLoading || matchesLoading || profileLoading;

  return (
    <>
      <PageBanner
        title={isAdmin ? 'Record Results' : 'Schedule & Results'}
        subtitle={isAdmin ? 'Edit/record results for games' : "View your team's schedule and game results"}
        actionLabel="< Back to Home"
        onAction={() => navigate('/')}
      />
      <div className="generator-content">
        <SeasonSelector />
        {loading ? (
          <p className="auth-loading">Loading...</p>
        ) : !teams || !matches ? (
          <LeagueEmptyState onGoToTeams={() => navigate('/seasons')} />
        ) : (
          <Routes>
            <Route
              index
              element={
                <CalendarView
                  matches={matches}
                  showAll={isAdmin}
                  filterTeamId={myTeam?.id}
                  onSelectMatch={(id) => navigate(`/schedule/match/${id}`)}
                />
              }
            />
            <Route
              path="match/:id"
              element={
                isAdmin ? (
                  <RecordResultsView
                    matches={matches}
                    teams={teams}
                    seasonId={selectedSeasonId}
                    onResultsSaved={refetch}
                  />
                ) : (
                  <GameDayView myTeamId={myTeam?.id} teams={teams} />
                )
              }
            />
          </Routes>
        )}
      </div>
    </>
  );
}

export default SchedulePage;
