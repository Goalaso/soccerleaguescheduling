require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

// Reuse the exact same mock roster the frontend used to hardcode, so
// seeded data matches what's been visible in the app so far.
const RAW_PLAYERS = [
  { name: 'Sofia Moreau', position: 'Goalkeeper', skill: 8, age: 27 },
  { name: 'Derek Nguyen', position: 'Goalkeeper', skill: 7, age: 31 },
  { name: 'Yasmin Ali', position: 'Goalkeeper', skill: 6, age: 24 },
  { name: 'Owen Bishop', position: 'Goalkeeper', skill: 9, age: 29 },

  { name: 'Marcus Leblanc', position: 'Forward', skill: 7, age: 28 },
  { name: 'Dana Reyes', position: 'Forward', skill: 3, age: 22 },
  { name: 'Lena Petrova', position: 'Forward', skill: 4, age: 25 },
  { name: 'Isabella Cruz', position: 'Forward', skill: 8, age: 26 },
  { name: 'Noah Kimura', position: 'Forward', skill: 6, age: 33 },
  { name: 'Aaliyah Brooks', position: 'Forward', skill: 5, age: 21 },
  { name: 'Theo Walsh', position: 'Forward', skill: 7, age: 30 },
  { name: 'Priya Nair', position: 'Forward', skill: 9, age: 27 },
  { name: 'Malik Johnson', position: 'Forward', skill: 4, age: 24 },
  { name: 'Chloe Fontaine', position: 'Forward', skill: 6, age: 29 },
  { name: 'Ravi Chandra', position: 'Forward', skill: 8, age: 32 },
  { name: 'Grace Kowalski', position: 'Forward', skill: 5, age: 23 },

  { name: 'Arash Karimi', position: 'Midfielder', skill: 8, age: 34 },
  { name: 'Tom Brennan', position: 'Midfielder', skill: 5, age: 31 },
  { name: 'James Whitfield', position: 'Midfielder', skill: 6, age: 33 },
  { name: 'Sara Delgado', position: 'Midfielder', skill: 7, age: 26 },
  { name: 'Ethan Park', position: 'Midfielder', skill: 4, age: 22 },
  { name: 'Nadia Hassan', position: 'Midfielder', skill: 9, age: 28 },
  { name: "Liam O'Connor", position: 'Midfielder', skill: 6, age: 35 },
  { name: 'Fatima Zohra', position: 'Midfielder', skill: 7, age: 24 },
  { name: 'Victor Alves', position: 'Midfielder', skill: 5, age: 30 },
  { name: 'Mia Thompson', position: 'Midfielder', skill: 8, age: 25 },
  { name: 'Kenji Watanabe', position: 'Midfielder', skill: 6, age: 29 },
  { name: 'Alina Petrenko', position: 'Midfielder', skill: 4, age: 21 },

  { name: 'Priya Sharma', position: 'Defender', skill: 5, age: 26 },
  { name: 'Wei Lin', position: 'Defender', skill: 7, age: 29 },
  { name: 'Carlos Mendez', position: 'Defender', skill: 6, age: 31 },
  { name: 'Julia Novak', position: 'Defender', skill: 8, age: 27 },
  { name: 'Samuel Osei', position: 'Defender', skill: 5, age: 24 },
  { name: 'Hana Suzuki', position: 'Defender', skill: 7, age: 33 },
  { name: 'Diego Fernandez', position: 'Defender', skill: 6, age: 28 },
  { name: 'Ingrid Larsen', position: 'Defender', skill: 9, age: 30 },
  { name: 'Marco Rossi', position: 'Defender', skill: 4, age: 25 },
  { name: 'Zara Ahmed', position: 'Defender', skill: 6, age: 22 },
  { name: 'Tobias Weber', position: 'Defender', skill: 7, age: 34 },
  { name: 'Camille Girard', position: 'Defender', skill: 5, age: 26 },
];

const PLAYERS = RAW_PLAYERS.map((player, index) => ({
  ...player,
  email: `${player.name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
  hasPhone: index % 5 !== 0,
  hasApp: index % 20 < 9,
}));

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin bootstrap.');
    return;
  }

  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (rows[0]) {
    console.log(`Admin user ${email} already exists — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'admin')`,
    [email.toLowerCase(), passwordHash, 'League Admin']
  );
  console.log(`Created admin user ${email}.`);
}

async function seedPlayers() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM players');
  if (rows[0].count > 0) {
    console.log(`players table already has ${rows[0].count} rows — skipping player seed.`);
    return;
  }

  for (const p of PLAYERS) {
    await pool.query(
      `INSERT INTO players (name, position, skill, age, email, has_phone, has_app)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [p.name, p.position, p.skill, p.age, p.email, p.hasPhone, p.hasApp]
    );
  }
  console.log(`Seeded ${PLAYERS.length} players.`);
}

async function run() {
  try {
    await seedAdmin();
    await seedPlayers();
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
