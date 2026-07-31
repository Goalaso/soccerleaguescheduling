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
import { generateTeams, summarizeBalance } from '../../utils/generateTeams';

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
  const {
    teams: savedTeams,
    loading: publishedLoading,
    publish,
  } = usePublishedTeams(season?.status === 'teams_generated' ? seasonId : null);

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
    }));

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

    if (savedTeams) {
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
                  onRegenerate={() => navigate(basePath)}
                  onPublish={handleSaveAndPublish}
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
