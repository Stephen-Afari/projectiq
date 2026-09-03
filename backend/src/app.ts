import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { projectsRouter } from './routes/projects.js';
import { meetingsRouter } from './routes/meetings.js';
import { actionsRouter } from './routes/actions.js';
import { risksRouter } from './routes/risks.js';
import { issuesRouter } from './routes/issues.js';
import { decisionsRouter } from './routes/decisions.js';
import { dependenciesRouter } from './routes/dependencies.js';
import { changeSignalsRouter } from './routes/changeSignals.js';
import { usersRouter } from './routes/users.js';
import { aiRouter } from './routes/ai.js';
import { webhooksRouter } from './routes/webhooks.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth } from './middleware/requireAuth.js';
import { apiRateLimit } from './middleware/apiRateLimit.js';
import { aiRateLimit } from './middleware/aiRateLimit.js';

/**
 * Builds the Express app without starting a server — split out of
 * index.ts so tests can import `app` and drive it with supertest without
 * opening a real port. index.ts is the only thing that calls
 * app.listen().
 */
export const app = express();

// Only the configured frontend origin — previously cors() with no
// options reflected any origin. See docs/decision-log/
// 2026-09-02-security-hardening.md.
app.use(cors({ origin: config.frontendBaseUrl }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRateLimit);

app.use('/api', healthRouter);

// requireAuth verifies the caller's Supabase Auth session and attaches
// req.user; applied to every router except health (liveness, must stay
// open) and webhooks (n8n uses its own shared-secret auth — see
// middleware/verifyWebhookSecret.ts, unchanged). aiRouter additionally
// gets aiRateLimit (tighter, per-user) since every call there costs a
// real Claude API request.
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/meetings', requireAuth, meetingsRouter);
app.use('/api/actions', requireAuth, actionsRouter);
app.use('/api/risks', requireAuth, risksRouter);
app.use('/api/issues', requireAuth, issuesRouter);
app.use('/api/decisions', requireAuth, decisionsRouter);
app.use('/api/dependencies', requireAuth, dependenciesRouter);
app.use('/api/change-signals', requireAuth, changeSignalsRouter);
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/ai', requireAuth, aiRateLimit, aiRouter);
app.use('/api/webhooks', webhooksRouter);

app.use(errorHandler);
