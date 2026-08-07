import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner';
import NotificationRow from './notifications/NotificationRow';
import { useNotifications } from '../hooks/useNotifications';

function NotificationsHistoryPage() {
  const navigate = useNavigate();
  const { notifications, loading, markRead, remove, respondToSeasonAvailability } = useNotifications({
    includeRead: true,
  });

  return (
    <>
      <PageBanner
        title="Notifications"
        subtitle="Everything sent to you, read or not"
        actionLabel="< Back to Home"
        onAction={() => navigate('/')}
      />
      <div className="generator-content">
        <div className="panel notifications-panel">
          {loading ? (
            <p className="auth-loading">Loading...</p>
          ) : notifications.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                markRead={markRead}
                remove={remove}
                respondToSeasonAvailability={respondToSeasonAvailability}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default NotificationsHistoryPage;
