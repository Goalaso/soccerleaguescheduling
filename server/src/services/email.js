const {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const smClient = new SecretsManagerClient({});

// Cached for the lifetime of a warm Lambda container — same pattern as
// server/src/lambda.js's handlerPromise, avoids a token refresh (and the
// resulting secret rewrite) on every single Graph call.
let cachedAccessToken = null; // { token, expiresAt }

async function readSecret() {
  const result = await smClient.send(
    new GetSecretValueCommand({ SecretId: process.env.OUTLOOK_SECRET_ARN })
  );
  return JSON.parse(result.SecretString);
}

// Microsoft rotates the refresh token on every use — the old one stops
// working once a new one is issued, so it has to be written back here or
// the *next* refresh fails. This is why the Lambda role needs
// PutSecretValue on this one secret, unlike the read-only database/JWT
// secrets (see infra/lib/infra-stack.ts).
async function writeSecret(secret) {
  await smClient.send(
    new PutSecretValueCommand({
      SecretId: process.env.OUTLOOK_SECRET_ARN,
      SecretString: JSON.stringify(secret),
    })
  );
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now) {
    return cachedAccessToken.token;
  }

  const secret = await readSecret();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: secret.refresh_token,
    client_id: secret.client_id,
    client_secret: secret.client_secret,
    // Mail.ReadWrite, not just Mail.Read — marking a processed message as
    // read (see waitlistPoll.js) is a write operation Mail.Read alone
    // doesn't cover, which is a real 403 we hit during testing.
    scope: 'offline_access Mail.ReadWrite Mail.Send',
  });

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Outlook token refresh failed: ${data.error_description || data.error || res.status}`);
  }

  await writeSecret({ ...secret, refresh_token: data.refresh_token });

  // Refresh a minute early so a call right at the boundary doesn't race a
  // token that's about to expire mid-request.
  cachedAccessToken = { token: data.access_token, expiresAt: now + (data.expires_in - 60) * 1000 };
  return cachedAccessToken.token;
}

async function graphFetch(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  // sendMail returns 202 with an empty body on success (not 204), and
  // PATCH-ing a message read also returns no body — text-first avoids
  // res.json() throwing on an empty response for either of those.
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Graph API ${options.method || 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function sendEmail({ to, subject, body }) {
  await graphFetch('/me/sendMail', {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    }),
  });
}

// Notification types that also go out by email, for recipients who've opted
// in. Starts with just the one case where missing it in-app — because you
// didn't happen to open the app — has a real cost: a missed availability
// deadline. Adding a future type is a one-line addition here, same pattern
// as ACTIONABLE_NOTIFICATION_TYPES on the frontend.
const EMAIL_NOTIFIED_TYPES = ['season_availability_request'];

module.exports = { getAccessToken, sendEmail, graphFetch, EMAIL_NOTIFIED_TYPES };
