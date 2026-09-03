# RAID Register

## ERP Transformation Programme — Apex Manufacturing Ltd

**Document type:** RAID Register (Risks, Assumptions, Issues, Dependencies)
**Version:** 1.2
**Last updated:** 2026-03-03
**Owner:** Priya Nair, Project Manager

## Risks

### R1 — Vendor migration team capacity

Meridian Systems, the implementation vendor, reassigned two senior data
migration engineers to another client engagement without advance notice.
Replacement engineers will not be fully ramped for two to three weeks.
This is a risk to the overall migration timeline, not only the sandbox
configuration workstream.

- **Probability:** High
- **Impact:** High
- **Owner:** Tom Reyes (Meridian Systems)
- **Mitigation:** Requested a written resourcing plan from Meridian
  covering the backfill timeline and any further planned reassignments.

### R2 — Finance UAT window constrained by quarter-end close

The Finance module's user acceptance testing window was originally
scheduled for the 24th of the month, which falls close to quarter-end
close activity. Finance team availability for UAT is limited during that
period.

- **Probability:** Medium
- **Impact:** Medium
- **Owner:** David Chen
- **Mitigation:** Schedule UAT sessions outside the close week; nominate
  backup testers from the finance team who are not directly involved in
  close activities.

### R3 — Legacy MRP data quality

Historical data in the legacy MRP system has known inconsistencies
(duplicate vendor records, inconsistent unit-of-measure codes) that may
require additional cleansing effort before migration.

- **Probability:** Medium
- **Impact:** Medium
- **Owner:** Michael Osei
- **Mitigation:** Data quality audit scheduled ahead of each module's
  migration cutover; cleansing rules to be agreed with each module's
  business owner.

## Assumptions

### A1 — Named user licence count

The approved budget assumed 120 named user licences for the ERP
platform. Actual licence requirements are dependent on final scoping by
each functional area.

### A2 — Warehouse management system remains unchanged

The programme assumes the existing warehouse management system's
interfaces remain stable throughout the programme; no changes to that
system are in scope.

### A3 — Vendor support timeline

The programme assumes Meridian Systems can deliver the phased go-live
schedule (Finance, then Procurement, then Production Planning) without
requiring additional resourcing beyond what was scoped at contract
signature.

## Issues

### I1 — Migration sandbox configuration delay

The migration sandbox was meant to be fully configured by end of week 3
but has hit two blockers related to the legacy MRP export format. The
workstream is currently running approximately ten days behind schedule,
which places pressure on the Finance UAT start date.

- **Status:** Open
- **Owner:** Michael Osei
- **Next step:** Firmer schedule estimate required before the programme
  schedule can be formally revised.

### I2 — Licensing budget overrun

Procurement's latest headcount mapping for the Production Planning
module identified 28 additional read-only seats (shift supervisors
requiring visibility into the new scheduling module) beyond the 120
originally budgeted, an approximate £86,000 overrun against the licensing
line at current list price.

- **Status:** Open
- **Owner:** David Chen
- **Next step:** Quantify the exact delta and bring to the next Steering
  Committee meeting to decide between trimming seats or requesting
  additional budget. Logged as a budget concern, not yet a formal change
  request.

## Dependencies

### D1 — Finance UAT start depends on sandbox configuration

The Finance module's UAT start date is directly dependent on the
migration sandbox being fully configured (see I1). A ten-day slip in the
sandbox workstream is expected to push Finance UAT from the 24th to early
April unless mitigated.

- **Upstream:** Migration sandbox configuration (IT Lead)
- **Downstream:** Finance UAT start date

### D2 — Procurement module scoping depends on Finance go-live learnings

The Procurement module's detailed scoping is planned to incorporate
lessons learned from the Finance module's go-live, particularly around
data migration cleansing effort.

- **Upstream:** Finance module go-live
- **Downstream:** Procurement module detailed scoping

### D3 — Production Planning seat count depends on shift supervisor rollout plan

The final licence count for Production Planning depends on confirmation
of which shift supervisor roles require scheduling module access (see
I2), which in turn depends on the production planning team's shift
coverage model, still being finalised.

- **Upstream:** Shift coverage model (Production Planning)
- **Downstream:** Production Planning module licence count
