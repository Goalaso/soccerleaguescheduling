const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const playersRoutes = require('./routes/players.routes');
const teamsRoutes = require('./routes/teams.routes');
const leaguesRoutes = require('./routes/leagues.routes');
const matchesRoutes = require('./routes/matches.routes');
const seasonsRoutes = require('./routes/seasons.routes');
const meRoutes = require('./routes/me.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

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
app.use('/api/me', meRoutes);

app.use(errorHandler);

module.exports = app;
