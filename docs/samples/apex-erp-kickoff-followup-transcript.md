# Apex Manufacturing Ltd — ERP Transformation Programme
## Steering Committee Follow-up — Week 4

**Date:** 2026-03-03
**Attendees:** Priya Nair (Project Manager), David Chen (Finance Lead), Michael Osei (IT Lead), Sarah Whitfield (Procurement Manager), Tom Reyes (Vendor PM, Meridian Systems)

---

**Priya Nair:** Thanks everyone for joining. Quick follow-up to kickoff — let's go round the workstreams. Michael, how's the migration tooling setup going?

**Michael Osei:** Slower than we'd like, honestly. We were meant to have the migration sandbox fully configured by end of last week, but we've hit two blockers with the legacy MRP export format. I'd say we're running about ten days behind on that piece right now.

**Priya Nair:** Ten days. Does that put pressure on the Finance UAT start date?

**Michael Osei:** It does, yes. Finance UAT was pencilled in for the 24th — if the sandbox slips another ten days we're looking at early April instead.

**David Chen:** That's tight against quarter-end close, same issue we flagged at kickoff. I'd rather we protect the UAT window than rush the sandbox.

**Priya Nair:** Understood. I'll take an action to revise the schedule once Michael has a firmer estimate.

**Tom Reyes:** On our side — Meridian's migration team, I want to flag something. We've had two of our senior data engineers roll off onto another client engagement this week. It wasn't communicated to us in advance either, so I only found out yesterday.

**Priya Nair:** That's concerning given how central Meridian is to the migration path. What's the impact?

**Tom Reyes:** We're backfilling, but the replacement engineers won't be fully ramped for two to three weeks. Realistically that's a risk to the whole migration timeline, not just the sandbox piece Michael mentioned.

**David Chen:** So we've potentially got a vendor capacity risk stacked on top of an already slipping schedule.

**Priya Nair:** Agreed, that needs to go on the risk register as high probability, high impact. Tom, can you get us a written resourcing plan from Meridian this week?

**Tom Reyes:** Yes, I'll chase that today.

**David Chen:** Separately — finance topic. I've reviewed the licensing quote from the ERP vendor against what was budgeted, and we're over. The original budget assumed 120 named user licences; procurement's latest headcount mapping puts us at 148.

**Sarah Whitfield:** That's on me to explain — production planning asked for another 28 seats after the initial scoping, mostly shift supervisors who need read access to the new scheduling module.

**David Chen:** Understood, but at current list price that's roughly an £86,000 overrun against the licensing line. I don't think we can absorb that without a change request.

**Priya Nair:** Let's log that as a budget concern rather than a formal change yet — David, can you quantify the exact delta and bring it to the next steering meeting so we can decide whether to trim seats or request additional budget?

**David Chen:** Will do.

**Priya Nair:** Now, a decision we do need to make today. Given the sandbox delay and the Meridian resourcing risk, do we hold the single go-live date, or move to the phased approach we discussed informally at kickoff?

**Michael Osei:** I'd recommend phased. Finance first, then Procurement and Production once the migration tooling has proven itself on a smaller scope.

**Sarah Whitfield:** Agreed from Procurement's side — we'd rather go second and benefit from lessons learned.

**David Chen:** Finance can live with going first if the UAT window is realistic.

**Priya Nair:** Okay — decision: we're adopting the phased go-live, Finance module first, Procurement and Production to follow once migration tooling is validated. I'll update the programme plan and communicate to the wider steering group.

**Priya Nair:** Last thing — dependency check. Sarah, the procurement workflow configuration work can't start in earnest until the vendor master data migration is complete, correct?

**Sarah Whitfield:** Correct, we're blocked on that. The procurement team can do design work in parallel, but configuration and testing needs clean vendor master data first.

**Priya Nair:** I'll log that as a formal dependency — procurement configuration depends on vendor master data migration completing. Michael, that ties back to your sandbox and migration timeline, so it's worth tracking closely given today's news from Tom.

**Michael Osei:** Agreed, I'll flag it in the migration plan.

**Priya Nair:** Good. Let's reconvene same time next week — David with the licensing numbers, Tom with the Meridian resourcing plan, Michael with a revised sandbox date. Thanks everyone.
