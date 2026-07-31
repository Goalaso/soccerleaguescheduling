import React from 'react';
import { usePendingActions } from '../hooks/usePendingActions';

// Homepage "needs your attention" panel. Only one producer exists today
// (pending season-availability responses), but this is written as a
// generic { type, message } list on purpose — see the notification-system
// project memory — so a real notification system can feed the same list
// later without a homepage rework.
function PendingActionsPanel() {
  const { actions, loading, respondToSeasonAvailability } = usePendingActions();

  if (loading || actions.length === 0) return null;

  return (
    <div className="panel pending-actions-panel">
      <h3 className="panel-title">Needs Your Attention</h3>
      {actions.map((action) => (
        <div className="pending-action-row" key={`${action.type}-${action.seasonId}`}>
          <span>{action.message}</span>
          {action.type === 'season_availability' && (
            <div className="pending-action-buttons">
              <button
                className="pill-btn pill-btn-blue"
                onClick={() => respondToSeasonAvailability(action.seasonId, true)}
              >
                Yes, I'm in
              </button>
              <button
                className="outline-btn"
                onClick={() => respondToSeasonAvailability(action.seasonId, false)}
              >
                Can't play
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default PendingActionsPanel;
