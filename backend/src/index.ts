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

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/risks', risksRouter);
app.use('/api/issues', issuesRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/dependencies', dependenciesRouter);
app.use('/api/change-signals', changeSignalsRouter);
app.use('/api/users', usersRouter);
app.use('/api/ai', aiRouter);
app.use('/api/webhooks', webhooksRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`ProjectIQ backend listening on port ${config.port}`);
});
