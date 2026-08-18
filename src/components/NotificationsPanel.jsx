import React from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import NotificationRow from './notifications/NotificationRow';

function NotificationsPanel() {
  const { notifications, loading, markRead, remove, respondToSeasonAvailability } = useNotifications();

  return (
    <div className="panel notifications-panel">
      <h3 className="panel-title">
        Needs Your Attention{notifications.length > 0 ? ` (${notifications.length})` : ''}
      </h3>
      {loading ? (
        <p className="auth-loading">Loading...</p>
      ) : notifications.length === 0 ? (
        <p className="empty-state-subtitle">You're all caught up — nothing pending right now.</p>
      ) : (
        <div className="notifications-scroll">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              markRead={markRead}
              remove={remove}
              respondToSeasonAvailability={respondToSeasonAvailability}
            />
          ))}
        </div>
      )}
      <Link to="/notifications" className="link-btn notifications-view-all">
        View all notifications &gt;
      </Link>
    </div>
  );
}

export default NotificationsPanel;
