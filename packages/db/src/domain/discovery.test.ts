import { describe, expect, it } from "vitest";

import {
  deterministicRecommendations,
  visibleDiscoveryQuestions,
} from "./discovery";

describe("Atlanta pilot discovery rules", () => {
  it("skips mortgage questions when no property is involved", () => {
    expect(
      visibleDiscoveryQuestions({ property_status: "no_real_property" }).map(
        ({ key }) => key,
      ),
    ).not.toContain("mortgage_status");
  });

  it("produces deterministic, explainable service recommendations", () => {
    const recommendations = deterministicRecommendations({
      financial_complexity: "complex",
      mortgage_status: "yes",
      property_status: "jointly_owned",
      support_interest: "yes",
    });
    expect(recommendations.map(({ service }) => service)).toEqual([
      "divorce_attorney",
      "mortgage_specialist",
      "financial_specialist",
      "personal_support",
    ]);
    expect(
      recommendations.every(({ explanation }) => explanation.length > 40),
    ).toBe(true);
  });

  it("does not make mortgage eligibility determinations", () => {
    const text = deterministicRecommendations({
      financial_complexity: "straightforward",
      mortgage_status: "unknown",
      property_status: "solely_owned",
      support_interest: "none",
    })
      .map(({ explanation }) => explanation)
      .join(" ");
    expect(text).toContain("not an eligibility determination");
  });
});
