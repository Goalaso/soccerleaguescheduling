CREATE TABLE notifications (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type               VARCHAR(50) NOT NULL,
  message            TEXT NOT NULL,
  action_url         VARCHAR(255),
  related_season_id  INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
  related_match_id   INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  data               JSONB,
  is_read            BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx ON notifications (user_id, is_read);

-- Dedup guards, for lazily-rechecked notification types only (a
-- directly-triggered, one-shot type should not populate related_season_id/
-- related_match_id if the same user could legitimately get more than one
-- such notification referencing the same season/match).
CREATE UNIQUE INDEX notifications_season_dedup ON notifications (user_id, type, related_season_id)
  WHERE related_season_id IS NOT NULL;
CREATE UNIQUE INDEX notifications_match_dedup ON notifications (user_id, type, related_match_id)
  WHERE related_match_id IS NOT NULL;
