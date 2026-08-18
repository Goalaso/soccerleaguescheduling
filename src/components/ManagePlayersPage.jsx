import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import PageBanner from './PageBanner';
import PlayerListView from './managePlayers/PlayerListView';
import PlayerFormView from './managePlayers/PlayerFormView';
import WaitlistView from './managePlayers/WaitlistView';
import { usePlayers } from '../hooks/usePlayers';
import { useLeagues } from '../hooks/useLeagues';

function ManagePlayersPage() {
  const navigate = useNavigate();
  const { players, loading, createPlayer, updatePlayer, deletePlayer } = usePlayers();
  const { leagues } = useLeagues();

  return (
    <>
      <PageBanner
        title="Add a Player"
        subtitle="Add a new player to the league"
        actionLabel="< Back to Home"
        onAction={() => navigate('/')}
      />
      <div className="generator-content">
        <Routes>
          <Route
            index
            element={
              <PlayerListView players={players} loading={loading} deletePlayer={deletePlayer} />
            }
          />
          <Route
            path="add"
            element={
              <PlayerFormView
                players={players}
                leagues={leagues}
                createPlayer={createPlayer}
                updatePlayer={updatePlayer}
              />
            }
          />
          <Route
            path="edit/:id"
            element={
              <PlayerFormView
                players={players}
                leagues={leagues}
                createPlayer={createPlayer}
                updatePlayer={updatePlayer}
              />
            }
          />
          <Route path="waitlist" element={<WaitlistView />} />
        </Routes>
      </div>
    </>
  );
}

export default ManagePlayersPage;
