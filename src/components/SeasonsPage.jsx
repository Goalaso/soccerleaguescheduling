import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner';
import SeasonsListView from './seasons/SeasonsListView';
import CreateSeasonView from './seasons/CreateSeasonView';
import AvailabilityReviewView from './seasons/AvailabilityReviewView';
import SeasonTeamGenerator from './seasons/SeasonTeamGenerator';
import { useSeasons } from '../hooks/useSeasons';
import { useLeagues } from '../hooks/useLeagues';

function SeasonsPage() {
  const navigate = useNavigate();
  const { seasons, loading, createSeason, deleteSeason, refetch } = useSeasons();
  const { leagues } = useLeagues();

  return (
    <>
      <PageBanner
        title="Seasons"
        subtitle="Create a season, collect player availability, then generate teams"
        actionLabel="< Back to Home"
        onAction={() => navigate('/')}
      />
      <div className="generator-content">
        <Routes>
          <Route
            index
            element={<SeasonsListView seasons={seasons} loading={loading} deleteSeason={deleteSeason} />}
          />
          <Route
            path="create"
            element={<CreateSeasonView leagues={leagues} createSeason={createSeason} />}
          />
          <Route
            path=":seasonId/availability"
            element={<AvailabilityReviewView onTeamsGenerated={refetch} />}
          />
          <Route path=":seasonId/generate/*" element={<SeasonTeamGenerator onPublished={refetch} />} />
        </Routes>
      </div>
    </>
  );
}

export default SeasonsPage;
