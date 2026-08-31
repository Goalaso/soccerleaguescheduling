import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import GenerationOptions from '../teamGenerator/GenerationOptions';
import PlayerTable from '../teamGenerator/PlayerTable';
import EmptyTeamsState from '../teamGenerator/EmptyTeamsState';
import GeneratedTeamsView from '../teamGenerator/GeneratedTeamsView';
import PublishedModal from '../teamGenerator/PublishedModal';
import NotifyPlayers from '../teamGenerator/NotifyPlayers';
import SentModal from '../teamGenerator/SentModal';
import { useSeason } from '../../hooks/useSeason';
import { useSeasonAvailability } from '../../hooks/useSeasonAvailability';
import { usePublishedTeams } from '../../hooks/usePublishedTeams';
import { generateTeams, summarizeBalance, summarizeTeam } from '../../utils/generateTeams';

const DEFAULT_MESSAGE =
  "Hi {first_name}, your team for this season has been announced! You've been assigned to {team_name}. View your full team roster and schedule at the link below.";

// Season-scoped adaptation of the original standalone team generator: same
// options/generate/publish/notify screens, but the candidate player pool is
// this season's confirmed-available players (not the full roster), and
// publishing writes to this specific, already-created season instead of
// spinning up a brand-new one.
function SeasonTeamGenerator({ onPublished }) {
  const { seasonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = `/seasons/${seasonId}/generate`;

  const { season } = useSeason(seasonId);
  const { players: availability, loading: availabilityLoading } = useSeasonAvailability(seasonId);
  // Always the real seasonId, not conditional on status — publishing is
  // exactly the action that flips status to 'teams_generated', so gating
  // this on that status being already true meant the publish mutation's
  // own request body would send seasonId: null right when it mattered.
  // Querying "already published teams" before any exist is harmless
  // (fetchSeasonTeams returns an empty teams array, not an error) as long
  // as the season itself is real, which it always is here.
  const { teams: savedTeams, loading: publishedLoading, publish } = usePublishedTeams(seasonId);

  // Sorted by respondedAt (earliest first), not just filtered — when there
  // are more confirmed players than capacity (only possible via an admin
  // override past the normal FCFS cap), generateTeams truncates to however
  // many fit by taking the front of this array, so the order here decides
  // who actually gets a spot. Without this, that cutoff fell back to
  // whatever order the API returned players in (alphabetical), silently
  // ignoring who actually responded first — the opposite of what the
  // waitlist system enforces during the availability phase itself.
  const eligiblePlayers = availability
    .filter((p) => p.isAvailable)
    .map((p) => ({
      id: p.playerId,
      name: p.name,
      position: p.position,
      skill: p.skill,
      age: p.age,
      hasPhone: p.hasPhone,
      hasApp: p.hasApp,
      respondedAt: p.respondedAt,
    }))
    .sort((a, b) => new Date(a.respondedAt) - new Date(b.respondedAt));

  const [searchTerm, setSearchTerm] = useState('');
  const [options, setOptions] = useState({ balanceBySkill: true, balanceByAge: false, balanceByPosition: false });
  const [teams, setTeams] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [modal, setModal] = useState(null);
  const [sentStats, setSentStats] = useState(null);
  const [publishError, setPublishError] = useState(null);
  const [deliveryMethods, setDeliveryMethods] = useState({ email: true, sms: true, app: false });
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [teamToggles, setTeamToggles] = useState({});

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (publishedLoading || hydratedRef.current) return;
    hydratedRef.current = true;

    // savedTeams is now always an array (never null — see the seasonId
    // change above), so an unpublished season returns [] rather than null;
    // .length distinguishes "genuinely nothing published yet" from "already
    // published," which a plain truthy check on an array can't.
    if (savedTeams && savedTeams.length > 0) {
      setTeams(savedTeams);
      setIsPublished(true);
      setTeamToggles(savedTeams.reduce((acc, t) => ({ ...acc, [t.id]: true }), {}));
      if (location.pathname === basePath) {
        navigate(`${basePath}/results`, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedLoading]);

  if (!season) {
    return <p className="auth-loading">Loading...</p>;
  }

  const fullOptions = {
    numTeams: season.numTeams,
    playersPerTeam: season.playersPerTeam,
    teamNames: season.teamNames,
    ...options,
  };

  const handleGenerate = () => {
    const nextTeams = generateTeams(eligiblePlayers, fullOptions);
    setTeams(nextTeams);
    setTeamToggles(nextTeams.reduce((acc, t) => ({ ...acc, [t.id]: true }), {}));
    setIsPublished(false);
    navigate(`${basePath}/results`);
  };

  const playerCount = teams ? teams.reduce((sum, t) => sum + t.players.length, 0) : 0;
  const balance = teams ? summarizeBalance(teams) : null;

  // Pre-publish editing is pure local state — nothing's persisted until
  // "Save & Publish" sends whatever split is currently in `teams`.
  const assignedIds = new Set((teams || []).flatMap((t) => t.players.map((p) => p.id)));
  const unassignedPlayers = eligiblePlayers.filter((p) => !assignedIds.has(p.id));

  const handleMovePlayer = (playerId, fromTeamId, toTeamId) => {
    setTeams((prev) => {
      const fromTeam = prev.find((t) => t.id === fromTeamId);
      const player = fromTeam?.players.find((p) => p.id === playerId);
      if (!player) return prev;
      return prev.map((t) => {
        if (t.id === fromTeamId) {
          return summarizeTeam({ ...t, players: t.players.filter((p) => p.id !== playerId) });
        }
        if (t.id === toTeamId) {
          return summarizeTeam({ ...t, players: [...t.players, player] });
        }
        return t;
      });
    });
  };

  const handleRemovePlayer = (playerId, teamId) => {
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId ? summarizeTeam({ ...t, players: t.players.filter((p) => p.id !== playerId) }) : t
      )
    );
  };

  const handleAddPlayer = (playerId, teamId) => {
    setTeams((prev) => {
      const player = eligiblePlayers.find((p) => p.id === playerId);
      if (!player) return prev;
      return prev.map((t) => (t.id === teamId ? summarizeTeam({ ...t, players: [...t.players, player] }) : t));
    });
  };

  const handleRenameTeam = (teamId, name) => {
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, name } : t)));
  };

  const toggleDeliveryMethod = (method) => setDeliveryMethods((prev) => ({ ...prev, [method]: !prev[method] }));
  const toggleTeam = (teamId) => setTeamToggles((prev) => ({ ...prev, [teamId]: !prev[teamId] }));

  const handleSend = () => {
    const activeTeams = teams.filter((t) => teamToggles[t.id]);
    const activePlayers = activeTeams.flatMap((t) => t.players);
    const emailCount = deliveryMethods.email ? activePlayers.length : 0;
    const smsCount = deliveryMethods.sms ? activePlayers.filter((p) => p.hasPhone).length : 0;
    const appCount = deliveryMethods.app ? activePlayers.filter((p) => p.hasApp).length : 0;

    setSentStats({
      players: activePlayers.length,
      teams: activeTeams.length,
      messages: emailCount + smsCount + appCount,
      delivered: 100,
      emailCount,
      smsCount,
      appCount,
    });
    setModal('sent');
  };

  const handleSaveAndPublish = async () => {
    setPublishError(null);
    try {
      await publish(teams);
      setIsPublished(true);
      setModal('published');
      if (onPublished) onPublished();
    } catch (err) {
      setPublishError(err.message);
    }
  };

  return (
    <>
      {availabilityLoading ? (
        <p className="auth-loading">Loading...</p>
      ) : (
        <Routes>
          <Route
            index
            element={
              <div className="generator-grid">
                <GenerationOptions
                  options={fullOptions}
                  setOptions={setOptions}
                  playerCount={eligiblePlayers.length}
                  onGenerate={handleGenerate}
                  disabled={eligiblePlayers.length === 0}
                  fixed
                  season={season}
                />
                <div className="generator-main">
                  <PlayerTable players={eligiblePlayers} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
                  {eligiblePlayers.length === 0 && <EmptyTeamsState />}
                </div>
              </div>
            }
          />

          <Route
            path="results"
            element={
              teams ? (
                <GeneratedTeamsView
                  teams={teams}
                  playerCount={playerCount}
                  isPublished={isPublished}
                  publishError={publishError}
                  unassignedPlayers={unassignedPlayers}
                  onRegenerate={() => navigate(basePath)}
                  onPublish={handleSaveAndPublish}
                  onMovePlayer={handleMovePlayer}
                  onRemovePlayer={handleRemovePlayer}
                  onAddPlayer={handleAddPlayer}
                  onRenameTeam={handleRenameTeam}
                />
              ) : (
                <Navigate to={basePath} replace />
              )
            }
          />

          <Route
            path="notify"
            element={
              teams ? (
                <NotifyPlayers
                  teams={teams}
                  playerCount={playerCount}
                  deliveryMethods={deliveryMethods}
                  onToggleDeliveryMethod={toggleDeliveryMethod}
                  message={message}
                  onMessageChange={setMessage}
                  teamToggles={teamToggles}
                  onToggleTeam={toggleTeam}
                  onBack={() => navigate(`${basePath}/results`)}
                  onSend={handleSend}
                />
              ) : (
                <Navigate to={basePath} replace />
              )
            }
          />
        </Routes>
      )}

      {modal === 'published' && teams && (
        <PublishedModal
          teamCount={teams.length}
          playerCount={playerCount}
          avgSkill={balance.avgSkill}
          balanceLabel={balance.label}
          onBackToHome={() => {
            setModal(null);
            navigate('/seasons');
          }}
          onNotify={() => {
            setModal(null);
            navigate(`${basePath}/notify`);
          }}
        />
      )}

      {modal === 'sent' && sentStats && (
        <SentModal
          stats={sentStats}
          onViewTeams={() => {
            setModal(null);
            navigate(`${basePath}/results`);
          }}
          onBackToHome={() => {
            setModal(null);
            navigate('/seasons');
          }}
        />
      )}
    </>
  );
}

export default SeasonTeamGenerator;
