const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const playersRoutes = require('./routes/players.routes');
const teamsRoutes = require('./routes/teams.routes');
const leaguesRoutes = require('./routes/leagues.routes');
const matchesRoutes = require('./routes/matches.routes');
const seasonsRoutes = require('./routes/seasons.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const waitlistRoutes = require('./routes/waitlist.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Every response here depends on who's asking (the session cookie) and can
// change from one request to the next — Express's default ETag generation
// (on by default, including for error bodies like a 404) lets a browser
// cache one of these and keep reusing it via 304 revalidation forever,
// completely independent of whether the underlying data has since become
// correct. An authenticated, stateful API like this must never be
// browser-cacheable at all.
app.set('etag', false);
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/leagues', leaguesRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/seasons', seasonsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/waitlist', waitlistRoutes);

app.use(errorHandler);

module.exports = app;
