import type { Project } from '../../db/types.js';
import type { ChangeSignalForImpact, DependencyForImpact, RiskForImpact } from './types.js';

export const PROMPT_VERSION = 'impact-analyst-v1';

export function buildSystemPrompt(): string {
  return `You are the Project Impact Analyst agent for ProjectIQ.

Your only job: for each risk, dependency, and change signal given to you, assess its potential
impact on schedule, cost, scope, resources, and dependencies, and call the
record_impact_analysis tool. You never take any action — every assessment is a suggestion for
human review, nothing is auto-applied.

For each item, decide whether a meaningful impact assessment applies at all:
- If YES: set applicable true and fill in whichever of schedule_impact, cost_impact,
  scope_impact, resource_impact, dependency_impact are relevant (a short sentence each; leave
  the rest null — do not force an impact into every category just to fill it in). reasoning
  must explain WHY you assessed it this way, referencing the item's own description/context.
- If NO (the item is too minor or too vague to project any real impact): set applicable false,
  leave all impact fields null, and use reasoning to briefly say why there's no material impact
  to project.

Every item you assess is inherently a judgement call, never a stated fact — confidence_type must
always be "inference". This field is fixed by the schema; just be sure your reasoning reflects
that you are projecting a plausible consequence, not reporting something anyone said.

Be conservative and specific. A vague "this could affect the schedule" is less useful than "this
may delay the Finance UAT start date given the current sandbox slip." If you cannot say anything
concrete, prefer applicable: false over a generic guess.`;
}

function describeProject(project: Project): string {
  return `Project: ${project.name}${project.description ? `\nDescription: ${project.description}` : ''}
Status: ${project.status} | Health: ${project.health}${project.target_date ? `\nTarget date: ${project.target_date}` : ''}`;
}

export interface ImpactAnalystPromptInput {
  project: Project;
  risks: RiskForImpact[];
  dependencies: DependencyForImpact[];
  changeSignals: ChangeSignalForImpact[];
}

function describeItems(input: ImpactAnalystPromptInput): string {
  const lines: string[] = [];
  if (input.risks.length) {
    lines.push('Risks:');
    for (const r of input.risks) {
      const dup = r.context_flags?.is_likely_duplicate
        ? ` [flagged as a likely duplicate of an existing risk]`
        : '';
      lines.push(
        `- ref=${r.ref} | ${r.description} (severity: ${r.severity ?? 'unknown'}, probability: ${r.probability ?? 'unknown'})${dup}`,
      );
    }
  }
  if (input.dependencies.length) {
    lines.push('Dependencies:');
    for (const d of input.dependencies) {
      lines.push(`- ref=${d.ref} | ${d.description} (${d.upstream_activity ?? '?'} → ${d.downstream_activity ?? '?'})`);
    }
  }
  if (input.changeSignals.length) {
    lines.push('Change signals:');
    for (const c of input.changeSignals) {
      lines.push(`- ref=${c.ref} | [${c.change_type}] ${c.description}`);
    }
  }
  return lines.join('\n');
}

export function buildUserPrompt(input: ImpactAnalystPromptInput): string {
  return `${describeProject(input.project)}

Items to assess:
${describeItems(input)}

Call record_impact_analysis with one assessment per item listed above.`;
}

export function buildRepairPrompt(
  input: ImpactAnalystPromptInput & { previousOutput: unknown; validationErrors: string },
): string {
  return `${buildUserPrompt(input)}

Your previous attempt to call record_impact_analysis did not match the required schema.

Previous output:
${JSON.stringify(input.previousOutput, null, 2)}

Validation errors:
${input.validationErrors}

Call record_impact_analysis again with a corrected result that fixes exactly these errors.`;
}
