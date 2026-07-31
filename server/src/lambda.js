const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

let handlerPromise;

async function buildHandler() {
  const client = new SecretsManagerClient({});
  const [dbSecret, jwtSecret] = await Promise.all([
    client.send(new GetSecretValueCommand({ SecretId: process.env.DATABASE_URL_SECRET_ARN })),
    client.send(new GetSecretValueCommand({ SecretId: process.env.JWT_SECRET_ARN })),
  ]);
  process.env.DATABASE_URL = dbSecret.SecretString;
  process.env.JWT_SECRET = jwtSecret.SecretString;

  // Required after env vars above are set — server/src/db/pool.js reads
  // DATABASE_URL at module load time.
  const serverlessHttp = require('serverless-http');
  const app = require('./app');
  return serverlessHttp(app);
}

module.exports.handler = async (event, context) => {
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
