import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NOTIFICATION_TYPES, ACTIONABLE_NOTIFICATION_TYPES } from '../../constants/notificationTypes';

// Shared between the homepage's unread-only panel and the full history page.
function NotificationRow({ notification: n, markRead, remove, respondToSeasonAvailability }) {
  const navigate = useNavigate();
  const isActionable = ACTIONABLE_NOTIFICATION_TYPES.includes(n.type);

  // Navigating to the relevant page isn't the same as resolving the
  // notification (e.g. "Go" on a needs-score reminder just opens the
  // record-results form — it's not resolved until the score is actually
  // submitted, which deletes it server-side). Only an explicit "mark as
  // read" click should dismiss it early.
  const handleGo = () => {
    if (n.actionUrl) navigate(n.actionUrl);
  };

  return (
    <div className={`notification-row ${n.isRead ? 'notification-row-read' : ''}`}>
      <span className="notification-message">{n.message}</span>
      <div className="notification-buttons">
        {!n.isRead && n.type === NOTIFICATION_TYPES.SEASON_AVAILABILITY_REQUEST && (
          <>
            <button
              className="pill-btn pill-btn-blue"
              onClick={() => respondToSeasonAvailability(n.relatedSeasonId, true)}
            >
              Yes, I'm in
            </button>
            <button className="outline-btn" onClick={() => respondToSeasonAvailability(n.relatedSeasonId, false)}>
              Can't play
            </button>
          </>
        )}
        {n.actionUrl && (
          <button className="pill-btn pill-btn-blue" onClick={handleGo}>
            Go
          </button>
        )}
        {/* Actionable notifications only clear via their own action above —
            no manual mark-read/delete escape hatch. */}
        {!isActionable && !n.isRead && (
          <button
            type="button"
            className="notification-icon-btn"
            title="Mark as read"
            onClick={() => markRead(n.id)}
          >
            ✓
          </button>
        )}
        {!isActionable && (
          <button type="button" className="notification-icon-btn" title="Delete" onClick={() => remove(n.id)}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default NotificationRow;
