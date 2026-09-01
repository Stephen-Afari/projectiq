-- ProjectIQ: severity-change tracking on risks, so the Project Alerts
-- workflow can surface "risks whose severity has worsened" instead of
-- guessing from the current value alone. Set by PATCH /api/risks/:id/edit
-- when an edit changes severity to something worse; cleared implicitly by
-- the next severity edit (no separate acknowledge flow). See
-- docs/decision-log/2026-08-28-n8n-approval-and-alerts-workflows.md.

alter table risks add column previous_severity risk_severity;
alter table risks add column severity_changed_at timestamptz;
