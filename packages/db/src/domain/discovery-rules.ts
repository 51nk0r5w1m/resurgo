import type { DiscoveryAnswers } from "./discovery-definition";

type Service =
  | "divorce_attorney"
  | "mortgage_specialist"
  | "financial_specialist"
  | "personal_support";

export type DiscoveryRecommendation = {
  explanation: string;
  ruleId: string;
  service: Service;
  title: string;
};

export type DiscoveryOutput = {
  classification: "shared" | "legal" | "financial" | "health";
  code: string;
  explanation: string;
  ruleId: string;
  title: string;
  type: "document_request" | "review_trigger";
};

function value(answers: DiscoveryAnswers, key: string) {
  const answer = answers[key];
  return answer?.status === "answered" ? answer.value : undefined;
}
function is(answers: DiscoveryAnswers, key: string, expected: unknown) {
  return value(answers, key) === expected;
}
function includes(answers: DiscoveryAnswers, key: string, expected: string) {
  const current = value(answers, key);
  return Array.isArray(current) && current.includes(expected);
}
function addressedUncertain(answers: DiscoveryAnswers, key: string) {
  const answer = answers[key];
  return (
    answer?.status === "unknown" ||
    answer?.status === "deferred" ||
    value(answers, key) === "unknown"
  );
}

export function evaluateDiscoveryRules(answers: DiscoveryAnswers) {
  const recommendations: DiscoveryRecommendation[] = [
    {
      service: "divorce_attorney",
      ruleId: "GA-LEGAL-001",
      title: "Confirm the Georgia legal path",
      explanation:
        "A qualified Georgia family law attorney can review jurisdiction, existing orders, and proposed terms. Resurgo does not provide legal advice.",
    },
  ];
  const outputs: DiscoveryOutput[] = [];

  const hasProperty = !is(answers, "property_status", "no_real_property");
  const hasMortgage =
    is(answers, "mortgage_status", "yes") ||
    addressedUncertain(answers, "mortgage_status");
  const retainingHome = is(answers, "housing_goal", "retain");
  const leavingHome = is(answers, "housing_goal", "leave");
  const titleClient = includes(answers, "title_holders", "client");
  const titleSpouse = includes(answers, "title_holders", "spouse");
  const mortgageClient = includes(answers, "mortgage_borrowers", "client");
  const mortgageSpouse = includes(answers, "mortgage_borrowers", "spouse");
  const titleMortgageMismatch =
    hasMortgage &&
    ((titleClient && !mortgageClient) ||
      (titleSpouse && !mortgageSpouse) ||
      (!titleClient && mortgageClient) ||
      (!titleSpouse && mortgageSpouse));

  if (hasProperty && hasMortgage) {
    recommendations.push({
      service: "mortgage_specialist",
      ruleId: "GA-MORTGAGE-001",
      title: "Review the property and mortgage transition",
      explanation:
        "A divorce-informed mortgage specialist can review loan obligations, documentation, and possible financing paths. This is not an eligibility determination.",
    });
    outputs.push(
      {
        type: "document_request",
        code: "mortgage_statement",
        title: "Current mortgage statement",
        explanation:
          "A current statement helps a qualified professional verify borrowers, balance, and servicing details.",
        classification: "financial",
        ruleId: "GA-DOC-001",
      },
      {
        type: "document_request",
        code: "property_title",
        title: "Recorded deed or current title record",
        explanation:
          "Title evidence helps distinguish ownership from mortgage liability.",
        classification: "financial",
        ruleId: "GA-DOC-002",
      },
    );
  }

  if (retainingHome && hasMortgage) {
    outputs.push({
      type: "review_trigger",
      code: "retain_joint_mortgage",
      title: "Home-retention feasibility review",
      explanation:
        "The stated goal to retain a mortgaged home requires coordinated attorney and mortgage-professional review.",
      classification: "financial",
      ruleId: "GA-REVIEW-001",
    });
  }
  if (leavingHome && mortgageClient) {
    outputs.push({
      type: "review_trigger",
      code: "continuing_mortgage_liability",
      title: "Continuing mortgage-liability review",
      explanation:
        "Leaving the property does not itself remove a borrower from the mortgage obligation.",
      classification: "financial",
      ruleId: "GA-REVIEW-002",
    });
  }
  if (titleMortgageMismatch) {
    outputs.push({
      type: "review_trigger",
      code: "title_mortgage_mismatch",
      title: "Title and loan-party mismatch",
      explanation:
        "The reported title holders and mortgage borrowers differ and should be verified from source documents.",
      classification: "financial",
      ruleId: "GA-REVIEW-003",
    });
  }
  if (
    value(answers, "refinance_deadline") &&
    !is(answers, "lender_review_status", "completed")
  ) {
    outputs.push({
      type: "review_trigger",
      code: "deadline_without_feasibility",
      title: "Proposed deadline needs feasibility review",
      explanation:
        "A financing deadline was reported without a completed lender feasibility review.",
      classification: "financial",
      ruleId: "GA-REVIEW-004",
    });
  }
  if (
    is(answers, "support_expected", "yes") ||
    includes(answers, "income_sources", "support")
  ) {
    outputs.push({
      type: "review_trigger",
      code: "support_dependent_housing",
      title: "Support-dependent housing review",
      explanation:
        "Expected support income may affect housing planning and requires qualified legal and mortgage review.",
      classification: "financial",
      ruleId: "GA-REVIEW-005",
    });
    outputs.push({
      type: "document_request",
      code: "support_terms",
      title: "Current support order or proposed support terms",
      explanation:
        "Exact written terms help professionals distinguish a proposal from an entered order.",
      classification: "legal",
      ruleId: "GA-DOC-003",
    });
  }
  if (is(answers, "has_dependents", "yes")) {
    outputs.push({
      type: "document_request",
      code: "parenting_and_support_records",
      title: "Current parenting and support records",
      explanation:
        "Existing parenting arrangements and support terms help a Georgia attorney distinguish current obligations from proposed changes.",
      classification: "legal",
      ruleId: "GA-DOC-006",
    });
  }

  const complexFinances =
    is(answers, "business_interest", "yes") ||
    includes(answers, "asset_types", "business") ||
    includes(answers, "income_sources", "self_employment") ||
    is(answers, "debt_certainty", "partial") ||
    is(answers, "debt_certainty", "uncertain") ||
    addressedUncertain(answers, "business_interest") ||
    includes(answers, "desired_services", "financial") ||
    includes(answers, "desired_services", "forensic");
  if (complexFinances) {
    recommendations.push({
      service: "financial_specialist",
      ruleId: "GA-FINANCIAL-001",
      title: "Organize and verify the financial picture",
      explanation:
        "A qualified financial specialist can help organize assets, liabilities, income, and valuation questions for professional review.",
    });
  }
  if (is(answers, "business_interest", "yes")) {
    outputs.push(
      {
        type: "review_trigger",
        code: "business_valuation",
        title: "Business valuation or forensic review",
        explanation:
          "A reported business interest may require valuation, income analysis, or tracing by a qualified specialist.",
        classification: "financial",
        ruleId: "GA-REVIEW-006",
      },
      {
        type: "document_request",
        code: "business_financials",
        title: "Business ownership and financial records",
        explanation:
          "Ownership records and recent financial statements help scope a qualified valuation or forensic review.",
        classification: "financial",
        ruleId: "GA-DOC-004",
      },
    );
  }
  if (
    includes(answers, "asset_types", "bank") ||
    includes(answers, "asset_types", "retirement") ||
    includes(answers, "asset_types", "investments")
  ) {
    outputs.push({
      type: "document_request",
      code: "financial_account_statements",
      title: "Recent financial account statements",
      explanation:
        "Recent statements create a source-based inventory for professional review without classifying ownership automatically.",
      classification: "financial",
      ruleId: "GA-DOC-007",
    });
  }
  if (
    includes(answers, "income_sources", "employment") ||
    includes(answers, "income_sources", "self_employment") ||
    includes(answers, "income_sources", "investment")
  ) {
    outputs.push({
      type: "document_request",
      code: "income_records",
      title: "Current income records",
      explanation:
        "Current pay, business, or investment records help qualified professionals verify the income sources reported in discovery.",
      classification: "financial",
      ruleId: "GA-DOC-008",
    });
  }
  if (
    is(answers, "debt_certainty", "partial") ||
    is(answers, "debt_certainty", "uncertain") ||
    includes(answers, "asset_types", "unknown")
  ) {
    outputs.push({
      type: "review_trigger",
      code: "ownership_or_debt_uncertainty",
      title: "Asset and liability verification",
      explanation:
        "Uncertainty about assets, ownership, or debts should lead to evidence gathering and professional review—not an automated conclusion.",
      classification: "financial",
      ruleId: "GA-REVIEW-007",
    });
  }
  if (
    is(answers, "settlement_housing_condition", "yes") ||
    addressedUncertain(answers, "settlement_housing_condition")
  ) {
    outputs.push({
      type: "review_trigger",
      code: "conditional_settlement_terms",
      title: "Unresolved settlement condition",
      explanation:
        "Reported settlement terms depend on a financial condition that has not been resolved or verified.",
      classification: "legal",
      ruleId: "GA-REVIEW-008",
    });
  }
  if (
    includes(answers, "existing_orders", "temporary_order") ||
    includes(answers, "existing_orders", "final_order") ||
    includes(answers, "existing_orders", "settlement_draft")
  ) {
    outputs.push({
      type: "document_request",
      code: "court_or_settlement_terms",
      title: "Current court order or settlement terms",
      explanation:
        "The exact document version should be reviewed before deadlines or obligations are added to the roadmap.",
      classification: "legal",
      ruleId: "GA-DOC-005",
    });
  }
  if (
    is(answers, "divorce_stage", "filed") ||
    is(answers, "divorce_stage", "negotiating")
  ) {
    outputs.push({
      type: "document_request",
      code: "filed_case_documents",
      title: "Filed pleadings and current case notices",
      explanation:
        "Filed documents and notices let counsel verify the court, current posture, and dates instead of relying on recollection.",
      classification: "legal",
      ruleId: "GA-DOC-009",
    });
  }
  if (includes(answers, "desired_services", "personal")) {
    recommendations.push({
      service: "personal_support",
      ruleId: "GA-SUPPORT-001",
      title: "Add optional transition support",
      explanation:
        "Optional personal-support services can help with practical transition needs and remain separate from legal and financial advice.",
    });
  }

  return {
    outputs: outputs.filter(
      (item, index) =>
        outputs.findIndex(({ code }) => code === item.code) === index,
    ),
    recommendations: recommendations.filter(
      (item, index) =>
        recommendations.findIndex(({ service }) => service === item.service) ===
        index,
    ),
  };
}
