import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerIcon from './icons/PlayerIcon';
import TrophyIcon from './icons/TrophyIcon';
import ChartIcon from './icons/ChartIcon';
import FieldGraphic from './FieldGraphic';
import FeatureItem from './FeatureItem';
import PageBanner from './PageBanner';
import NotificationsPanel from './NotificationsPanel';
import { useNotifications } from '../hooks/useNotifications';
import { useWaitlist } from '../hooks/useWaitlist';
import { useAuth } from '../context/AuthContext';

function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { notifications } = useNotifications();
  const hasNotifications = notifications.length > 0;
  const { entries: waitlistEntries } = useWaitlist({ enabled: isAdmin });
  const waitlistCount = waitlistEntries.length;

  return (
    <>
      <PageBanner
        title="Boeing Indoor Soccer League Management"
        subtitle="Monday Night League | Winter 2026 Season"
        actionLabel="View Schedule"
        onAction={() => navigate('/schedule')}
      />

      <div className="generator-content">
        <NotificationsPanel />
        {isAdmin && waitlistCount > 0 && (
          <button className="waitlist-alert-banner" onClick={() => navigate('/players/waitlist')}>
            <span>
              ({waitlistCount}) player{waitlistCount === 1 ? '' : 's'} on the waitlist
            </span>
            <span className="waitlist-alert-go">Go &gt;</span>
          </button>
        )}
      </div>

      <section className="hero-card">
        <div className="hero-top">
          <div className="hero-copy">
            {hasNotifications ? (
              <>
                <p className="hero-eyebrow">
                  {notifications.length} update{notifications.length === 1 ? '' : 's'}
                </p>
                <h2>Action Needed</h2>
                <p className="hero-body">Check the list above to respond.</p>
              </>
            ) : (
              <>
                <p className="hero-eyebrow">All caught up</p>
                <h2>Welcome back</h2>
                <p className="hero-body">Nothing needs your attention right now.</p>
              </>
            )}
            <button className="pill-btn pill-btn-light" onClick={() => navigate('/seasons')}>
              View Seasons
            </button>
          </div>

          <div className="hero-image">
            <FieldGraphic />
          </div>
        </div>

        {isAdmin && (
          <div className="feature-row">
            <FeatureItem
              icon={<PlayerIcon />}
              title="Manage Players"
              description="Add or edit players, skill ratings, and position preferences."
              onClick={() => navigate('/players')}
            />
            <FeatureItem
              icon={<TrophyIcon />}
              title="Record Game Results"
              description="Enter final scores and player goal counts for completed games."
              onClick={() => navigate('/schedule')}
            />
            <FeatureItem
              icon={<ChartIcon />}
              title="View Standings"
              description="See updated league standings and team performance"
              onClick={() => navigate('/league/standings')}
            />
          </div>
        )}
      </section>
    </>
  );
}

export default HomePage;
