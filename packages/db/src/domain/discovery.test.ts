import { describe, expect, it } from "vitest";

import {
  applicableDiscoveryQuestions,
  atlantaDiscoveryQuestions,
  evaluateDiscoveryRules,
  type DiscoveryAnswers,
} from "./discovery";

const answered = (value: unknown) => ({
  source: "client_reported" as const,
  status: "answered" as const,
  value,
  verificationStatus: "client_confirmed" as const,
});

function scenario(values: Record<string, unknown>): DiscoveryAnswers {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, answered(value)]),
  );
}

describe("versioned Atlanta pilot discovery engine", () => {
  it("contains 40 reusable questions across nine modules", () => {
    expect(atlantaDiscoveryQuestions).toHaveLength(40);
    expect(
      new Set(atlantaDiscoveryQuestions.map(({ module }) => module)).size,
    ).toBe(9);
  });

  it("branches a cooperative case away from property, mortgage, and child follow-ups", () => {
    const answers = scenario({
      business_interest: "no",
      debt_certainty: "confident",
      desired_services: ["none"],
      divorce_stage: "considering",
      existing_orders: ["none"],
      has_dependents: "no",
      income_sources: ["other"],
      property_status: "no_real_property",
    });
    const applicable = applicableDiscoveryQuestions(answers).map(
      ({ key }) => key,
    );
    const result = evaluateDiscoveryRules(answers);
    expect(applicable).not.toContain("mortgage_status");
    expect(applicable).not.toContain("dependent_summary");
    expect(result.recommendations.map(({ service }) => service)).toEqual([
      "divorce_attorney",
    ]);
    expect(result.outputs).toEqual([]);
  });

  it("creates home-retention mortgage evidence and feasibility review", () => {
    const answers = scenario({
      asset_types: ["real_property"],
      housing_goal: "retain",
      lender_review_status: "not_started",
      mortgage_borrowers: ["client", "spouse"],
      mortgage_status: "yes",
      property_status: "jointly_owned",
      title_holders: ["client", "spouse"],
    });
    const result = evaluateDiscoveryRules(answers);
    expect(result.recommendations.map(({ service }) => service)).toContain(
      "mortgage_specialist",
    );
    expect(result.outputs.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "mortgage_statement",
        "property_title",
        "retain_joint_mortgage",
      ]),
    );
  });

  it("flags continuing liability when the client leaves a jointly owned home", () => {
    const result = evaluateDiscoveryRules(
      scenario({
        housing_goal: "leave",
        mortgage_borrowers: ["client", "spouse"],
        mortgage_status: "yes",
        property_status: "jointly_owned",
        title_holders: ["client", "spouse"],
      }),
    );
    expect(result.outputs.map(({ code }) => code)).toContain(
      "continuing_mortgage_liability",
    );
    expect(result.outputs.map(({ code }) => code)).not.toContain(
      "retain_joint_mortgage",
    );
  });

  it("creates parenting records and support-dependent housing review", () => {
    const result = evaluateDiscoveryRules(
      scenario({
        has_dependents: "yes",
        income_sources: ["employment", "support"],
        support_expected: "yes",
      }),
    );
    expect(result.outputs.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "support_dependent_housing",
        "support_terms",
        "parenting_and_support_records",
        "income_records",
      ]),
    );
  });

  it("expands a complex business case and produces forensic review outputs", () => {
    const answers = scenario({
      asset_types: ["bank", "retirement", "business", "unknown"],
      business_interest: "yes",
      debt_certainty: "uncertain",
      divorce_stage: "negotiating",
      existing_orders: ["settlement_draft"],
      has_dependents: "yes",
      housing_goal: "retain",
      income_sources: ["self_employment", "support"],
      mortgage_status: "yes",
      property_status: "multiple",
      settlement_housing_condition: "yes",
      support_expected: "yes",
    });
    const result = evaluateDiscoveryRules(answers);
    expect(applicableDiscoveryQuestions(answers).length).toBeGreaterThan(30);
    expect(result.recommendations.map(({ service }) => service)).toEqual(
      expect.arrayContaining([
        "divorce_attorney",
        "mortgage_specialist",
        "financial_specialist",
      ]),
    );
    expect(result.outputs.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "business_valuation",
        "business_financials",
        "financial_account_statements",
        "ownership_or_debt_uncertainty",
        "conditional_settlement_terms",
      ]),
    );
  });
});
