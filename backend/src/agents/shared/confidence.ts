import { z } from 'zod';

/**
 * Shared across all agents: FACT (directly/explicitly stated), INFERENCE
 * (the agent's own judgement), RECOMMENDATION (a suggested step nobody
 * proposed) — see CLAUDE.md AI Rules. One definition, imported everywhere,
 * so the three labels can't drift between agents.
 */
export const confidenceTypeSchema = z.enum(['fact', 'inference', 'recommendation']);
