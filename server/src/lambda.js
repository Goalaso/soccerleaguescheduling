const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let handlerPromise;
let dbEnvPromise;

// Shared by both the HTTP path and the EventBridge waitlist-poll path below
// — both need DATABASE_URL set before anything requires server/src/db/pool.js,
// which reads it at module load time.
async function ensureDbEnv() {
  if (!dbEnvPromise) {
    dbEnvPromise = (async () => {
      const client = new SecretsManagerClient({});
      const [dbSecret, jwtSecret] = await Promise.all([
        client.send(new GetSecretValueCommand({ SecretId: process.env.DATABASE_URL_SECRET_ARN })),
        client.send(new GetSecretValueCommand({ SecretId: process.env.JWT_SECRET_ARN })),
      ]);
      process.env.DATABASE_URL = dbSecret.SecretString;
      process.env.JWT_SECRET = jwtSecret.SecretString;
    })().catch((err) => {
      dbEnvPromise = null;
      throw err;
    });
  }
  return dbEnvPromise;
}

async function buildHandler() {
  await ensureDbEnv();

  // Required after env vars above are set — server/src/db/pool.js reads
  // DATABASE_URL at module load time.
  const serverlessHttp = require('serverless-http');
  const app = require('./app');
  return serverlessHttp(app);
}

module.exports.handler = async (event, context) => {
  // EventBridge's scheduled waitlist-inbox poll, not an API Gateway HTTP
  // event — every native EventBridge invocation carries this marker, so no
  // custom synthetic payload is needed to tell the two apart.
  if (event.source === 'aws.events') {
    await ensureDbEnv();
    const { checkWaitlistInbox } = require('./services/waitlistPoll');
    return checkWaitlistInbox();
  }

  if (!handlerPromise) {
    // Don't cache a failed attempt — a transient error (e.g. IAM policy
    // propagation lag right after a fresh deploy) would otherwise be
    // replayed forever by this warm container instead of retried.
    handlerPromise = buildHandler().catch((err) => {
      handlerPromise = null;
      throw err;
    });
  }
  const httpHandler = await handlerPromise;
  return httpHandler(event, context);
};
