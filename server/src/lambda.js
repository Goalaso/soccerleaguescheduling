const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

let handlerPromise;
let dbEnvPromise;

// Shared by both the HTTP path and the EventBridge waitlist-poll path below
// — both need DATABASE_URL set before anything requires server/src/db/pool.js,
// which reads it at module load time.
async function ensureDbEnv() {
  if (!dbEnvPromise) {
    dbEnvPromise = (async () => {
      const client = new SSMClient({});
      const [dbParam, jwtParam] = await Promise.all([
        client.send(new GetParameterCommand({ Name: process.env.DATABASE_URL_PARAM, WithDecryption: true })),
        client.send(new GetParameterCommand({ Name: process.env.JWT_SECRET_PARAM, WithDecryption: true })),
      ]);
      process.env.DATABASE_URL = dbParam.Parameter.Value;
      process.env.JWT_SECRET = jwtParam.Parameter.Value;
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
