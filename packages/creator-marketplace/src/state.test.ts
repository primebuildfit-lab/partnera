import { describe, expect, it } from "vitest";
import {
  APPLICATION_TRANSITIONS,
  isTerminal,
  OPPORTUNITY_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  SUBMISSION_TRANSITIONS,
  transition,
} from "./state";

describe("opportunity state machine", () => {
  it("allows draft → open and open → closed", () => {
    expect(transition(OPPORTUNITY_TRANSITIONS, "opportunity", "draft", "open").ok).toBe(true);
    expect(transition(OPPORTUNITY_TRANSITIONS, "opportunity", "open", "closed").ok).toBe(true);
  });
  it("rejects re-opening a closed opportunity", () => {
    const r = transition(OPPORTUNITY_TRANSITIONS, "opportunity", "closed", "open");
    expect(r.ok).toBe(false);
  });
  it("treats archived as terminal", () => {
    expect(isTerminal(OPPORTUNITY_TRANSITIONS, "archived")).toBe(true);
  });
});

describe("application state machine", () => {
  it("only accepted opens a job path; blocked is terminal", () => {
    expect(transition(APPLICATION_TRANSITIONS, "application", "invited", "accepted").ok).toBe(true);
    expect(isTerminal(APPLICATION_TRANSITIONS, "blocked")).toBe(true);
  });
  it("cannot accept an already-rejected application", () => {
    expect(transition(APPLICATION_TRANSITIONS, "application", "rejected", "accepted").ok).toBe(false);
  });
});

describe("submission state machine", () => {
  it("safety hard-fail can reject from validating", () => {
    expect(transition(SUBMISSION_TRANSITIONS, "submission", "validating", "rejected").ok).toBe(true);
  });
  it("a rejected submission cannot jump straight to approved (only via dispute)", () => {
    expect(transition(SUBMISSION_TRANSITIONS, "submission", "rejected", "approved").ok).toBe(false);
    expect(transition(SUBMISSION_TRANSITIONS, "submission", "rejected", "disputed").ok).toBe(true);
    expect(transition(SUBMISSION_TRANSITIONS, "submission", "disputed", "approved").ok).toBe(true);
  });
  it("revision routes back through validating on resubmit", () => {
    expect(transition(SUBMISSION_TRANSITIONS, "submission", "revision_requested", "resubmitted").ok).toBe(true);
    expect(transition(SUBMISSION_TRANSITIONS, "submission", "resubmitted", "validating").ok).toBe(true);
  });
});

describe("payment state machine", () => {
  it("payment cannot become approved before pending_approval, nor paid before processing", () => {
    expect(transition(PAYMENT_TRANSITIONS, "payment", "not_eligible", "approved").ok).toBe(false);
    expect(transition(PAYMENT_TRANSITIONS, "payment", "not_eligible", "pending_approval").ok).toBe(true);
    expect(transition(PAYMENT_TRANSITIONS, "payment", "approved", "paid").ok).toBe(false);
    expect(transition(PAYMENT_TRANSITIONS, "payment", "processing", "paid").ok).toBe(true);
  });
  it("paid can only be reversed or disputed, never edited to cancelled", () => {
    expect(transition(PAYMENT_TRANSITIONS, "payment", "paid", "reversed").ok).toBe(true);
    expect(transition(PAYMENT_TRANSITIONS, "payment", "paid", "cancelled").ok).toBe(false);
  });
});
