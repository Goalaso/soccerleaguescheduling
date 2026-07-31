import React from 'react';
import { useNavigate } from 'react-router-dom';
import PlayerIcon from './icons/PlayerIcon';
import TrophyIcon from './icons/TrophyIcon';
import ChartIcon from './icons/ChartIcon';
import FieldGraphic from './FieldGraphic';
import FeatureItem from './FeatureItem';
import PageBanner from './PageBanner';
import PendingActionsPanel from './PendingActionsPanel';
import { useAuth } from '../context/AuthContext';

function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <PageBanner
        title="Boeing Indoor Soccer League Management"
        subtitle="Monday Night League | Winter 2026 Season"
        actionLabel="View Schedule"
        onAction={() => navigate('/schedule')}
      />

      {user && (
        <div className="generator-content">
          <PendingActionsPanel />
        </div>
      )}

      <section className="hero-card">
        <div className="hero-top">
          <div className="hero-copy">
            <p className="hero-eyebrow">New Season</p>
            <h2>Action Needed</h2>
            <p className="hero-body">
              Please proceed to the Team Generator to create teams!
            </p>
            <button
              className="pill-btn pill-btn-light"
              onClick={() => navigate('/seasons')}
            >
              View Seasons
            </button>
          </div>

          <div className="hero-image">
            <FieldGraphic />
          </div>
        </div>

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
      </section>
    </>
  );
}

export default HomePage;
