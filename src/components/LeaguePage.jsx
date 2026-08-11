import React, { useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import PageBanner from './PageBanner';
import SeasonSelector from './SeasonSelector';
import LeagueEmptyState from './league/LeagueEmptyState';
import StandingsView from './league/StandingsView';
import TeamHistoryView from './league/TeamHistoryView';
import TeamProfileView from './league/TeamProfileView';
import PlayerStatsView from './league/PlayerStatsView';
import { usePublishedTeams } from '../hooks/usePublishedTeams';
import { useMatches } from '../hooks/useMatches';
import { useTeamStats } from '../hooks/useTeamStats';
import { useSelectedSeason } from '../context/SelectedSeasonContext';
import { useAuth } from '../context/AuthContext';
import { buildSeasonFromMatches, getTeamMatches, matchResultLetter } from '../utils/season';

// goalsForTeam only counts goals scored *while playing for this team* — a
// player borrowed elsewhere for a match doesn't inflate their home team's
// top-scorer callout with goals scored on loan.
function getTeamTopScorer(team, goalsForTeam) {
  let best = null;
  team.players.forEach((p) => {
    const goals = goalsForTeam[p.id] || 0;
    if (!best || goals > best.goals) {
      best = { name: p.name, position: p.position, goals };
    }
  });
  return best;
}

function useSelectedTeam(season) {
  const { teamId } = useParams();
  const id = Number(teamId);
  const standing = season.standings.find((s) => s.team.id === id);
  if (!standing) return null;

  const rank = season.standings.findIndex((s) => s.team.id === id) + 1;
  const matches = getTeamMatches(season, id);
  const recentForm = matches.slice(0, 5).map((m) => matchResultLetter(m, id));
  const topScorer = getTeamTopScorer(standing.team, season.teamPlayerGoals[id] || {});

  return { id, standing, rank, matches, recentForm, topScorer };
}

function TeamHistoryRoute({ season }) {
  const navigate = useNavigate();
  const selected = useSelectedTeam(season);
  if (!selected) return <Navigate to="/league/standings" replace />;

  return (
    <TeamHistoryView
      team={selected.standing.team}
      standing={selected.standing}
      rank={selected.rank}
      recentForm={selected.recentForm}
      topScorer={selected.topScorer}
      matches={selected.matches}
      onBack={() => navigate('/league/standings')}
      onGoToProfile={() => navigate(`/league/team/${selected.id}/profile`)}
      onGoToPlayerStats={() => navigate(`/league/team/players?team=${selected.id}`)}
    />
  );
}

function TeamProfileRoute({ season, seasonId, roster }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const selected = useSelectedTeam(season);
  if (!selected) return <Navigate to="/league/standings" replace />;

  return (
    <TeamProfileView
      team={selected.standing.team}
      standing={selected.standing}
      rank={selected.rank}
      recentForm={selected.recentForm}
      topScorer={selected.topScorer}
      playerGoals={season.teamPlayerGoals[selected.id] || {}}
      onBack={() => navigate(`/league/team/${selected.id}`)}
      onGoToSchedule={() => navigate('/schedule')}
      onGoToPlayerStats={() => navigate(`/league/team/players?team=${selected.id}`)}
      isAdmin={user?.role === 'admin'}
      allTeams={season.standings.map((s) => s.team)}
      seasonId={seasonId}
      {...roster}
    />
  );
}

function LeaguePage() {
  const navigate = useNavigate();
  const { selectedSeason, selectedSeasonId, loading: seasonLoading } = useSelectedSeason();
  const {
    teams: savedTeams,
    loading: teamsLoading,
    addSeasonPlayer,
    removeSeasonPlayer,
    moveSeasonPlayer,
    setCaptain,
  } = usePublishedTeams(selectedSeasonId);
  const { matches, loading: matchesLoading } = useMatches(selectedSeasonId);
  const { gamesPlayedByPlayer } = useTeamStats(selectedSeasonId);
  const season = useMemo(
    () => (savedTeams && matches ? buildSeasonFromMatches(matches, savedTeams) : null),
    [savedTeams, matches]
  );

  const banner = (
    <PageBanner
      title="League Standings"
      subtitle={selectedSeason ? `${selectedSeason.leagueName} | ${selectedSeason.name}` : 'League Standings'}
      actionLabel="< Back to Home"
      onAction={() => navigate('/')}
    />
  );

  if (seasonLoading || teamsLoading || matchesLoading) {
    return (
      <>
        {banner}
        <div className="generator-content">
          <p className="auth-loading">Loading...</p>
        </div>
      </>
    );
  }

  if (!season) {
    return (
      <>
        {banner}
        <div className="generator-content">
          <SeasonSelector />
          <LeagueEmptyState onGoToTeams={() => navigate('/seasons')} />
        </div>
      </>
    );
  }

  return (
    <>
      {banner}

      <div className="generator-content">
        <SeasonSelector />
        <Routes>
          <Route index element={<Navigate to="standings" replace />} />
          <Route
            path="standings"
            element={
              <StandingsView
                season={season}
                onSelectTeam={(teamId) => navigate(`/league/team/${teamId}`)}
                onGoToSchedule={() => navigate('/schedule')}
                onGoToPlayerStats={() => navigate('/league/team/players')}
              />
            }
          />
          <Route
            path="team/players"
            element={
              <PlayerStatsView
                season={season}
                gamesPlayedByPlayer={gamesPlayedByPlayer}
                onBack={() => navigate('/league/standings')}
              />
            }
          />
          <Route path="team/:teamId" element={<TeamHistoryRoute season={season} />} />
          <Route
            path="team/:teamId/profile"
            element={
              <TeamProfileRoute
                season={season}
                seasonId={selectedSeasonId}
                roster={{ addSeasonPlayer, removeSeasonPlayer, moveSeasonPlayer, setCaptain }}
              />
            }
          />
        </Routes>
      </div>
    </>
  );
}

export default LeaguePage;
