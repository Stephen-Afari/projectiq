/**
 * AI pipeline evaluation harness — measures real Claude output quality
 * against a hand-authored golden set (docs/eval/), separate from the
 * offline/mocked Phase 6 Vitest suite. Calls the real Anthropic API via
 * the same agent functions the app uses, but bypasses the Express routes
 * and runMeetingAnalysisPipeline's DB-fetched "existing items" lookup —
 * every agent used here (Meeting/Context/Impact Analyst, Project
 * Assistant) is pure and DB-free, so this script makes zero database
 * writes and needs nothing but ANTHROPIC_API_KEY. Safely re-runnable any
 * time; never touches the real seeded Apex org/project.
 *
 * Run: npm run eval
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMeetingAnalyst } from '../src/agents/meeting-analyst/index.js';
import { runContextAnalyst } from '../src/agents/context-analyst/index.js';
import { runImpactAnalyst } from '../src/agents/impact-analyst/index.js';
import { runProjectAssistant } from '../src/agents/project-assistant/index.js';
import { withRefs } from '../src/agents/shared/refs.js';
import { computeSubHealth } from '../src/lib/projectHealth.js';
import { computeProjectAlerts } from '../src/lib/projectAlerts.js';
import { getMostRecentMeetingDate } from '../src/lib/projectMeetings.js';
import { config } from '../src/config.js';
import type {
  Project,
  Meeting,
  Action,
  Risk,
  Issue,
  Decision,
  Dependency,
  ChangeSignal,
  ConfidenceType,
} from '../src/db/types.js';
import type { ProjectAssistantInput } from '../src/agents/project-assistant/types.js';

const EVAL_ROOT = fileURLToPath(new URL('../../docs/eval', import.meta.url));
const TRANSCRIPTS_DIR = path.join(EVAL_ROOT, 'transcripts');
const EXPECTED_DIR = path.join(EVAL_ROOT, 'expected');
const QUESTIONS_PATH = path.join(EVAL_ROOT, 'assistant-questions.json');
const REPORTS_DIR = path.join(EVAL_ROOT, 'reports');

const CATEGORIES = ['actions', 'risks', 'issues', 'decisions', 'dependencies', 'change_signals'] as const;
type Category = (typeof CATEGORIES)[number];

interface ExpectedItem {
  keywords: string[];
  confidence_type: ConfidenceType;
  note?: string;
}
interface ExpectedFile {
  actions: ExpectedItem[];
  risks: ExpectedItem[];
  issues: ExpectedItem[];
  decisions: ExpectedItem[];
  dependencies: ExpectedItem[];
  change_signals: ExpectedItem[];
}

interface ExtractedItem {
  text: string;
  confidence_type: ConfidenceType;
}

interface CategoryScore {
  hits: Array<{ expected: ExpectedItem; extracted: ExtractedItem; labelMatch: boolean }>;
  misses: ExpectedItem[];
  falsePositives: ExtractedItem[];
  extraRecommendations: ExtractedItem[];
}

function scoreCategory(extracted: ExtractedItem[], expected: ExpectedItem[]): CategoryScore {
  const consumed = new Set<number>();
  const hits: CategoryScore['hits'] = [];
  const misses: ExpectedItem[] = [];

  for (const exp of expected) {
    const idx = extracted.findIndex((item, i) => {
      if (consumed.has(i)) return false;
      const lower = item.text.toLowerCase();
      return exp.keywords.every((kw) => lower.includes(kw.toLowerCase()));
    });
    if (idx === -1) {
      misses.push(exp);
    } else {
      consumed.add(idx);
      hits.push({ expected: exp, extracted: extracted[idx]!, labelMatch: extracted[idx]!.confidence_type === exp.confidence_type });
    }
  }

  const falsePositives: ExtractedItem[] = [];
  const extraRecommendations: ExtractedItem[] = [];
  extracted.forEach((item, i) => {
    if (consumed.has(i)) return;
    // Recommendations are the agent's own unprompted advice, not something
    // a golden set can enumerate in advance — don't penalize them as
    // hallucinations; report them separately, informationally.
    if (item.confidence_type === 'recommendation') extraRecommendations.push(item);
    else falsePositives.push(item);
  });

  return { hits, misses, falsePositives, extraRecommendations };
}

interface TranscriptResult {
  slug: string;
  meetingValidationPassed: boolean;
  contextValidationPassed: boolean | null;
  impactValidationPassed: boolean | null;
  scores: Record<Category, CategoryScore>;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fixtureProject(id: string): Project {
  return {
    id,
    organisation_id: 'eval-org',
    name: 'ERP Transformation Programme (Eval)',
    description: 'Fictional Apex Manufacturing ERP Transformation Programme, used only for AI pipeline evaluation.',
    status: 'active',
    health: 'amber',
    start_date: null,
    target_date: null,
    created_at: new Date().toISOString(),
  };
}

function fixtureMeeting(id: string, projectId: string, title: string): Meeting {
  return {
    id,
    project_id: projectId,
    title,
    meeting_date: today(),
    source: 'eval',
    transcript_reference: null,
    summary: null,
    analysis_status: 'pending',
    analysis_error: null,
    created_at: new Date().toISOString(),
  };
}

async function loadGoldenSet(): Promise<Array<{ slug: string; transcript: string; expected: ExpectedFile }>> {
  const files = (await readdir(TRANSCRIPTS_DIR)).filter((f) => f.endsWith('.txt')).sort();
  const set: Array<{ slug: string; transcript: string; expected: ExpectedFile }> = [];
  for (const file of files) {
    const slug = file.replace(/\.txt$/, '');
    const transcript = await readFile(path.join(TRANSCRIPTS_DIR, file), 'utf-8');
    const expectedRaw = await readFile(path.join(EXPECTED_DIR, `${slug}.json`), 'utf-8');
    const expected = JSON.parse(expectedRaw) as ExpectedFile;
    set.push({ slug, transcript, expected });
  }
  return set;
}

async function evaluateTranscript(slug: string, transcript: string, expected: ExpectedFile): Promise<TranscriptResult> {
  const project = fixtureProject(`eval-project-${slug}`);
  const meeting = fixtureMeeting(`eval-meeting-${slug}`, project.id, `Eval: ${slug}`);

  const meetingRun = await runMeetingAnalyst({ transcript, project, meeting });

  const emptyScores: Record<Category, CategoryScore> = {
    actions: { hits: [], misses: expected.actions, falsePositives: [], extraRecommendations: [] },
    risks: { hits: [], misses: expected.risks, falsePositives: [], extraRecommendations: [] },
    issues: { hits: [], misses: expected.issues, falsePositives: [], extraRecommendations: [] },
    decisions: { hits: [], misses: expected.decisions, falsePositives: [], extraRecommendations: [] },
    dependencies: { hits: [], misses: expected.dependencies, falsePositives: [], extraRecommendations: [] },
    change_signals: { hits: [], misses: expected.change_signals, falsePositives: [], extraRecommendations: [] },
  };

  if (!meetingRun.validationPassed || !meetingRun.result) {
    return {
      slug,
      meetingValidationPassed: false,
      contextValidationPassed: null,
      impactValidationPassed: null,
      scores: emptyScores,
    };
  }

  const result = meetingRun.result;
  const newActions = withRefs('action', result.actions);
  const newRisks = withRefs('risk', result.risks);
  const newDecisions = withRefs('decision', result.decisions);
  const newDependencies = withRefs('dependency', result.dependencies);
  const newChangeSignals = withRefs('change_signal', result.change_signals);

  const contextRun = await runContextAnalyst({
    newActions,
    newRisks,
    newDecisions,
    existingActions: [],
    existingRisks: [],
    existingDecisions: [],
  });

  const annotationsByRef = new Map(
    contextRun.validationPassed && contextRun.result
      ? contextRun.result.annotations.map((a) => [a.item_ref, a])
      : [],
  );
  const risksWithContext = newRisks.map((r) => ({
    ...r,
    context_flags: annotationsByRef.has(r.ref)
      ? {
          is_likely_duplicate: annotationsByRef.get(r.ref)!.is_likely_duplicate,
          duplicate_of_id: annotationsByRef.get(r.ref)!.duplicate_of_id,
          duplicate_reasoning: annotationsByRef.get(r.ref)!.duplicate_reasoning,
          related_items: annotationsByRef.get(r.ref)!.related_items,
          confidence_type: annotationsByRef.get(r.ref)!.confidence_type,
        }
      : null,
  }));

  const impactRun = await runImpactAnalyst({
    project,
    risks: risksWithContext,
    dependencies: newDependencies,
    changeSignals: newChangeSignals,
  });

  const toItems = (arr: Array<{ description: string; confidence_type: ConfidenceType }>): ExtractedItem[] =>
    arr.map((a) => ({ text: a.description, confidence_type: a.confidence_type }));

  const scores: Record<Category, CategoryScore> = {
    actions: scoreCategory(toItems(result.actions), expected.actions),
    risks: scoreCategory(toItems(result.risks), expected.risks),
    issues: scoreCategory(toItems(result.issues), expected.issues),
    decisions: scoreCategory(
      result.decisions.map((d) => ({ text: d.decision, confidence_type: d.confidence_type })),
      expected.decisions,
    ),
    dependencies: scoreCategory(toItems(result.dependencies), expected.dependencies),
    change_signals: scoreCategory(toItems(result.change_signals), expected.change_signals),
  };

  return {
    slug,
    meetingValidationPassed: true,
    contextValidationPassed: contextRun.validationPassed,
    impactValidationPassed: impactRun.validationPassed,
    scores,
  };
}

// --- Assistant grounding check -------------------------------------------------

interface AssistantQuestion {
  question: string;
  expect_data_gap: boolean;
  expected_answer_keywords: string[];
  expected_citation_ref: string | null;
}

function buildAssistantFixtures(): {
  project: Project;
  meetings: Meeting[];
  actions: Action[];
  risks: Risk[];
  issues: Issue[];
  decisions: Decision[];
  dependencies: Dependency[];
  changeSignals: ChangeSignal[];
} {
  const project = fixtureProject('eval-project-assistant');
  const auditBase = {
    source_excerpt: null,
    approved_by: null,
    approved_at: null,
    created_by_agent: 'eval-fixture',
  };

  const meetings: Meeting[] = [
    fixtureMeeting('meeting-schedule-delay', project.id, 'Eval: schedule-delay'),
    fixtureMeeting('meeting-formal-decision', project.id, 'Eval: formal-decision'),
    fixtureMeeting('meeting-budget-overrun', project.id, 'Eval: budget-overrun'),
    fixtureMeeting('meeting-dependency-block', project.id, 'Eval: dependency-block'),
  ];

  const actions: Action[] = [
    {
      id: 'action-schedule-delay-0',
      project_id: project.id,
      meeting_id: 'meeting-schedule-delay',
      description: 'Escalate the UAT sandbox provisioning ticket with the infrastructure team',
      owner: 'Michael Osei',
      due_date: today(),
      priority: 'high',
      status: 'open',
      approval_status: 'approved',
      confidence_type: 'fact',
      context_flags: null,
      created_at: new Date().toISOString(),
      ...auditBase,
    },
  ];

  const risks: Risk[] = [
    {
      id: 'risk-supplier-risk-0',
      project_id: project.id,
      meeting_id: null,
      description: 'Integration vendor lost two senior engineers, threatening the connector delivery schedule',
      probability: 'medium',
      impact: 'high',
      severity: 'high',
      owner: 'Tom Reyes',
      mitigation: null,
      status: 'open',
      context_flags: null,
      impact_assessment: null,
      previous_severity: null,
      severity_changed_at: null,
      created_at: new Date().toISOString(),
      approval_status: 'approved',
      confidence_type: 'inference',
      ...auditBase,
    },
  ];

  const issues: Issue[] = [
    {
      id: 'issue-budget-overrun-0',
      project_id: project.id,
      meeting_id: 'meeting-budget-overrun',
      description: 'Integration workstream already invoiced $210,000 against an $180,000 budget',
      owner: 'David Chen',
      severity: 'high',
      status: 'open',
      resolution: null,
      created_at: new Date().toISOString(),
      approval_status: 'approved',
      confidence_type: 'fact',
      ...auditBase,
    },
  ];

  const decisions: Decision[] = [
    {
      id: 'decision-formal-decision-0',
      project_id: project.id,
      meeting_id: 'meeting-formal-decision',
      decision: 'Adopt a phased go-live: finance module first, then procurement, then production planning',
      decision_owner: 'Priya Nair',
      decision_date: today(),
      impact: null,
      context_flags: null,
      created_at: new Date().toISOString(),
      approval_status: 'approved',
      confidence_type: 'fact',
      ...auditBase,
    },
  ];

  const dependencies: Dependency[] = [
    {
      id: 'dependency-dependency-block-0',
      project_id: project.id,
      meeting_id: 'meeting-dependency-block',
      description: 'Production planning configuration is blocked until finance completes its data migration',
      upstream_activity: 'Finance data migration',
      downstream_activity: 'Production planning configuration',
      owner: 'Sarah Whitfield',
      status: 'blocked',
      impact_assessment: null,
      created_at: new Date().toISOString(),
      approval_status: 'approved',
      confidence_type: 'fact',
      ...auditBase,
    },
  ];

  const changeSignals: ChangeSignal[] = [
    {
      id: 'change_signal-scope-change-0',
      project_id: project.id,
      meeting_id: null,
      change_type: 'scope',
      description: 'New regulatory reporting requirement adds scope not in the original baseline',
      potential_impact: 'Requires change control before build starts',
      status: 'open',
      impact_assessment: null,
      created_at: new Date().toISOString(),
      approval_status: 'approved',
      confidence_type: 'fact',
      ...auditBase,
    },
  ];

  return { project, meetings, actions, risks, issues, decisions, dependencies, changeSignals };
}

interface AssistantQuestionResult {
  question: string;
  validationPassed: boolean;
  dataGapCorrect: boolean;
  keywordsFound: boolean;
  citationCorrect: boolean;
  pass: boolean;
  answerText: string;
  dataGap: string | null;
}

async function evaluateAssistant(questions: AssistantQuestion[]): Promise<AssistantQuestionResult[]> {
  const fixtures = buildAssistantFixtures();
  const subHealth = computeSubHealth(fixtures.risks, fixtures.dependencies, fixtures.changeSignals, 0);
  const alerts = computeProjectAlerts(fixtures.actions, fixtures.risks, fixtures.decisions);
  const sinceLastMeeting = getMostRecentMeetingDate(fixtures.meetings);

  const knownIds: Record<string, Set<string>> = {
    action: new Set(fixtures.actions.map((a) => a.id)),
    risk: new Set(fixtures.risks.map((r) => r.id)),
    issue: new Set(fixtures.issues.map((i) => i.id)),
    decision: new Set(fixtures.decisions.map((d) => d.id)),
    dependency: new Set(fixtures.dependencies.map((d) => d.id)),
    change_signal: new Set(fixtures.changeSignals.map((c) => c.id)),
    meeting: new Set(fixtures.meetings.map((m) => m.id)),
    document: new Set(),
  };

  const results: AssistantQuestionResult[] = [];

  for (const q of questions) {
    const input: ProjectAssistantInput = {
      project: fixtures.project,
      subHealth,
      question: q.question,
      sinceLastMeeting,
      meetings: fixtures.meetings,
      retrievedChunks: [],
      actions: fixtures.actions,
      risks: fixtures.risks,
      issues: fixtures.issues,
      dependencies: fixtures.dependencies,
      changeSignals: fixtures.changeSignals,
      decisions: fixtures.decisions,
      overdueActions: alerts.overdueActions,
      worseningRisks: alerts.worseningRisks,
      pendingDecisions: alerts.pendingDecisions,
    };

    const run = await runProjectAssistant(input);

    if (!run.validationPassed || !run.result) {
      results.push({
        question: q.question,
        validationPassed: false,
        dataGapCorrect: false,
        keywordsFound: false,
        citationCorrect: false,
        pass: false,
        answerText: '',
        dataGap: null,
      });
      continue;
    }

    // Same defense-in-depth re-validation the real route does: drop any
    // citation whose id isn't in the actual known set for its type.
    const validatedAnswer = run.result.answer.map((point) => ({
      ...point,
      citations: point.citations.filter((c) => knownIds[c.type]?.has(c.id) ?? false),
    }));

    const answerText = validatedAnswer.map((p) => p.text).join(' ');
    const dataGap = run.result.data_gap;

    const dataGapCorrect = q.expect_data_gap ? dataGap !== null : true;
    const keywordsFound = q.expected_answer_keywords.every((kw) =>
      answerText.toLowerCase().includes(kw.toLowerCase()),
    );
    const citationCorrect = q.expected_citation_ref
      ? validatedAnswer.some((p) => p.citations.some((c) => c.id === q.expected_citation_ref))
      : true;

    const pass = q.expect_data_gap
      ? dataGapCorrect
      : dataGapCorrect && keywordsFound && citationCorrect;

    results.push({
      question: q.question,
      validationPassed: true,
      dataGapCorrect,
      keywordsFound,
      citationCorrect,
      pass,
      answerText,
      dataGap,
    });
  }

  return results;
}

// --- Reporting ------------------------------------------------------------

function sumCategory(results: TranscriptResult[], cat: Category) {
  let hits = 0;
  let misses = 0;
  let fps = 0;
  let labelMatches = 0;
  for (const r of results) {
    const s = r.scores[cat];
    hits += s.hits.length;
    misses += s.misses.length;
    fps += s.falsePositives.length;
    labelMatches += s.hits.filter((h) => h.labelMatch).length;
  }
  const precision = hits + fps > 0 ? hits / (hits + fps) : hits === 0 ? 1 : 0;
  const recall = hits + misses > 0 ? hits / (hits + misses) : 1;
  const labelAccuracy = hits > 0 ? labelMatches / hits : null;
  return { hits, misses, fps, precision, recall, labelAccuracy };
}

async function main() {
  if (!config.anthropicApiKey) {
    console.error('ANTHROPIC_API_KEY is not set — cannot run a real-API evaluation.');
    process.exit(1);
  }

  console.log('Loading golden set...');
  const goldenSet = await loadGoldenSet();
  console.log(`  ${goldenSet.length} transcripts loaded.\n`);

  const results: TranscriptResult[] = [];
  for (const { slug, transcript, expected } of goldenSet) {
    console.log(`Evaluating: ${slug}...`);
    const result = await evaluateTranscript(slug, transcript, expected);
    results.push(result);
    console.log(
      `  meeting-analyst valid=${result.meetingValidationPassed} context valid=${result.contextValidationPassed} impact valid=${result.impactValidationPassed}`,
    );
  }

  console.log('\nEvaluating Project Assistant grounding...');
  const questions = JSON.parse(await readFile(QUESTIONS_PATH, 'utf-8')) as AssistantQuestion[];
  const assistantResults = await evaluateAssistant(questions);

  // --- Console summary ---
  console.log('\n=== Extraction accuracy by category ===');
  const categoryTotals: Record<Category, ReturnType<typeof sumCategory>> = {} as never;
  for (const cat of CATEGORIES) {
    const t = sumCategory(results, cat);
    categoryTotals[cat] = t;
    console.log(
      `${cat.padEnd(15)} hits=${t.hits} misses=${t.misses} false_positives=${t.fps} ` +
        `precision=${(t.precision * 100).toFixed(0)}% recall=${(t.recall * 100).toFixed(0)}% ` +
        `label_accuracy=${t.labelAccuracy === null ? 'n/a' : (t.labelAccuracy * 100).toFixed(0) + '%'}`,
    );
  }

  const allHits = CATEGORIES.reduce((s, c) => s + categoryTotals[c].hits, 0);
  const allLabelMatches = CATEGORIES.reduce(
    (s, c) => s + (categoryTotals[c].labelAccuracy === null ? 0 : categoryTotals[c].labelAccuracy! * categoryTotals[c].hits),
    0,
  );
  const overallLabelAccuracy = allHits > 0 ? allLabelMatches / allHits : null;
  console.log(
    `\nOverall label accuracy (FACT/INFERENCE/RECOMMENDATION correctness across all hits): ${
      overallLabelAccuracy === null ? 'n/a' : (overallLabelAccuracy * 100).toFixed(0) + '%'
    }`,
  );

  console.log('\n=== Assistant grounding ===');
  const assistantPassed = assistantResults.filter((r) => r.pass).length;
  for (const r of assistantResults) {
    console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.question}`);
  }
  console.log(`Assistant grounding: ${assistantPassed}/${assistantResults.length} passed`);

  console.log('\n=== Guardrails ===');
  const allValidations = [
    ...results.map((r) => r.meetingValidationPassed),
    ...results.map((r) => r.contextValidationPassed).filter((v): v is boolean => v !== null),
    ...results.map((r) => r.impactValidationPassed).filter((v): v is boolean => v !== null),
    ...assistantResults.map((r) => r.validationPassed),
  ];
  const guardrailsPassed = allValidations.every(Boolean);
  console.log(
    `Schema validation held on ${allValidations.filter(Boolean).length}/${allValidations.length} real API calls ` +
      `(no approval_status/approved_by field exists in any agent schema — auto-approval is structurally impossible; ` +
      `Impact Analyst confidence_type is schema-locked to "inference").`,
  );
  console.log(`Guardrails: ${guardrailsPassed ? 'PASS' : 'FAIL'}`);

  // --- Write dated report ---
  await mkdir(REPORTS_DIR, { recursive: true });
  const date = today();
  const reportPath = path.join(REPORTS_DIR, `${date}-eval-run.md`);

  const lines: string[] = [];
  lines.push(`# AI Pipeline Evaluation Run — ${date}`);
  lines.push('');
  lines.push(`Golden set: ${goldenSet.length} transcripts. Real Anthropic API calls, no mocks, no DB writes.`);
  lines.push('');
  lines.push('## Extraction accuracy by category');
  lines.push('');
  lines.push('| Category | Hits | Misses | False Positives | Precision | Recall | Label Accuracy |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const cat of CATEGORIES) {
    const t = categoryTotals[cat];
    lines.push(
      `| ${cat} | ${t.hits} | ${t.misses} | ${t.fps} | ${(t.precision * 100).toFixed(0)}% | ${(t.recall * 100).toFixed(0)}% | ${
        t.labelAccuracy === null ? 'n/a' : (t.labelAccuracy * 100).toFixed(0) + '%'
      } |`,
    );
  }
  lines.push('');
  lines.push(
    `**Overall label accuracy**: ${overallLabelAccuracy === null ? 'n/a' : (overallLabelAccuracy * 100).toFixed(0) + '%'}`,
  );
  lines.push('');
  lines.push('## Assistant grounding');
  lines.push('');
  lines.push(`${assistantPassed}/${assistantResults.length} questions passed.`);
  lines.push('');
  for (const r of assistantResults) {
    lines.push(`- [${r.pass ? 'PASS' : 'FAIL'}] "${r.question}"`);
    lines.push(
      `  - data_gap: ${JSON.stringify(r.dataGap)} | keywords_found: ${r.keywordsFound} | citation_correct: ${r.citationCorrect}`,
    );
    lines.push(`  - answer: ${r.answerText.slice(0, 300)}`);
  }
  lines.push('');
  lines.push('## Guardrails');
  lines.push('');
  lines.push(
    `Schema validation held on ${allValidations.filter(Boolean).length}/${allValidations.length} real API calls. ` +
      `${guardrailsPassed ? 'PASS' : 'FAIL'}.`,
  );
  lines.push('');
  lines.push('## Per-transcript detail');
  lines.push('');
  for (const r of results) {
    lines.push(`### ${r.slug}`);
    lines.push('');
    for (const cat of CATEGORIES) {
      const s = r.scores[cat];
      if (s.hits.length === 0 && s.misses.length === 0 && s.falsePositives.length === 0 && s.extraRecommendations.length === 0) {
        continue;
      }
      lines.push(`**${cat}**`);
      for (const h of s.hits) {
        lines.push(
          `- HIT: "${h.extracted.text}" (expected keywords: ${h.expected.keywords.join(', ')}; label ${h.labelMatch ? 'correct' : `WRONG — got ${h.extracted.confidence_type}, expected ${h.expected.confidence_type}`})`,
        );
      }
      for (const m of s.misses) {
        lines.push(`- MISS: expected keywords [${m.keywords.join(', ')}] (${m.confidence_type}) — not found`);
      }
      for (const fp of s.falsePositives) {
        lines.push(`- FALSE POSITIVE: "${fp.text}" (labeled ${fp.confidence_type})`);
      }
      for (const rec of s.extraRecommendations) {
        lines.push(`- extra recommendation (not scored): "${rec.text}"`);
      }
      lines.push('');
    }
  }

  await writeFile(reportPath, lines.join('\n'), 'utf-8');
  console.log(`\nReport written to ${path.relative(process.cwd(), reportPath)}`);

  if (!guardrailsPassed) {
    console.error('\nGuardrail failure: at least one real API call failed schema validation after retries.');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Eval run failed:', err);
  process.exit(1);
});
