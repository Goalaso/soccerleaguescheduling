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
  const { selectedSeasonId, loading: seasonLoading } = useSelectedSeason();
  const { teams, loading: teamsLoading } = usePublishedTeams(selectedSeasonId);
  const { matches, loading: matchesLoading, refetch } = useMatches(selectedSeasonId);
  const { profile } = useMyProfile();
  const isAdmin = user?.role === 'admin';

  const myTeam = teams?.find((t) => t.players.some((p) => p.id === profile?.id));

  const loading = seasonLoading || teamsLoading || matchesLoading;

  return (
    <>
      <PageBanner
        title="Record Results"
        subtitle="Edit/record results for games"
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
