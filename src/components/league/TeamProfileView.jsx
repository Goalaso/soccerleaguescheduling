import React from 'react';
import TeamSummaryCard from './TeamSummaryCard';
import RosterTable from './RosterTable';
import SkillByPositionPanel from './SkillByPositionPanel';
import PositionBreakdownPanel from './PositionBreakdownPanel';

function TeamProfileView({
  team,
  standing,
  rank,
  recentForm,
  topScorer,
  playerGoals,
  onBack,
  onGoToSchedule,
}) {
  return (
    <div className="league-section">
      <div className="notify-breadcrumb">
        <button className="link-btn" onClick={onBack}>
          &lt; Match History
        </button>
        <span className="notify-breadcrumb-title">{team.name} — Profile</span>
        <span className="generated-subtitle">
          Monday Night League · Winter 2026
        </span>
        <div className="league-breadcrumb-actions">
          <button className="outline-btn" title="Coming soon" disabled>
            Player Stats
          </button>
          <button className="outline-btn" onClick={onGoToSchedule}>
            Schedule
          </button>
        </div>
      </div>

      <div className="league-profile-grid">
        <TeamSummaryCard
          team={team}
          standing={standing}
          rank={rank}
          recentForm={recentForm}
          topScorer={topScorer}
          variant="profile"
        />
        <RosterTable players={team.players} playerGoals={playerGoals} />
        <div className="notify-sidebar">
          <SkillByPositionPanel players={team.players} />
          <PositionBreakdownPanel players={team.players} />
        </div>
      </div>
    </div>
  );
}

export default TeamProfileView;
