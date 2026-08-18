ALTER TABLE users ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

-- A holding pen, not a shortcut into players — approving a row is a manual
-- admin action (via the existing Add Player flow), same review-before-real
-- pattern as roster edits and captain score submissions.
CREATE TABLE waitlist_entries (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  raw_subject   TEXT,
  raw_snippet   TEXT,
  season_open   BOOLEAN NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ
);

CREATE INDEX waitlist_entries_status_idx ON waitlist_entries (status);
