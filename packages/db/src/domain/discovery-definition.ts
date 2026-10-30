export const ATLANTA_DISCOVERY_VERSION = "atlanta-pilot-2026.1";

export type AnswerStatus =
  "answered" | "unknown" | "not_applicable" | "deferred";
export type AnswerSource =
  "client_reported" | "document_reported" | "professional_reported";
export type VerificationStatus =
  | "unverified"
  | "client_confirmed"
  | "document_verified"
  | "professional_reviewed";
export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "date"
  | "currency"
  | "text"
  | "structured_entities"
  | "document_reference";

export type DiscoveryAnswer = {
  documentVersionId?: string;
  source: AnswerSource;
  status: AnswerStatus;
  value: unknown;
  verificationStatus: VerificationStatus;
};
export type DiscoveryAnswers = Record<string, DiscoveryAnswer | undefined>;

type Condition =
  | { key: string; operator: "equals" | "not_equals"; value: unknown }
  | { key: string; operator: "includes"; value: string }
  | { conditions: Condition[]; operator: "all" | "any" };

export type DiscoveryQuestion = {
  classification: "shared" | "legal" | "financial" | "health";
  condition?: Condition;
  help?: string;
  key: string;
  label: string;
  module: DiscoveryModuleKey;
  options?: ReadonlyArray<{ label: string; value: string }>;
  placeholder?: string;
  prompt: string;
  required: boolean;
  type: QuestionType;
  why: string;
};

export type DiscoveryModuleKey =
  | "stage"
  | "safety"
  | "children"
  | "property"
  | "mortgage"
  | "financial"
  | "business"
  | "orders"
  | "support";

export const discoveryModules: ReadonlyArray<{
  description: string;
  key: DiscoveryModuleKey;
  title: string;
}> = [
  {
    key: "stage",
    title: "Divorce stage & representation",
    description:
      "Understand where the legal process stands and who is already helping.",
  },
  {
    key: "safety",
    title: "Safety & confidential communications",
    description:
      "Keep communications and future coordination appropriate for your circumstances.",
  },
  {
    key: "children",
    title: "Children & dependents",
    description:
      "Identify parenting and support facts that may affect housing and transition planning.",
  },
  {
    key: "property",
    title: "Property ownership & housing",
    description:
      "Clarify title, occupancy, and each person's intended housing transition.",
  },
  {
    key: "mortgage",
    title: "Mortgage obligations & financing goals",
    description:
      "Separate property ownership from loan liability and surface questions for lender review.",
  },
  {
    key: "financial",
    title: "Income, support, assets & liabilities",
    description:
      "Organize financial facts without making eligibility or legal determinations.",
  },
  {
    key: "business",
    title: "Business & complex interests",
    description:
      "Flag interests that may need valuation, tracing, or specialist review.",
  },
  {
    key: "orders",
    title: "Court orders & settlement obligations",
    description:
      "Capture existing Georgia case milestones and conditions that affect next steps.",
  },
  {
    key: "support",
    title: "Professional services & transition support",
    description:
      "Choose the practical and professional help you want to explore.",
  },
] as const;

const option = (value: string, label: string) => ({ label, value });
const yesNoUnknown = [
  option("yes", "Yes"),
  option("no", "No"),
  option("unknown", "I’m not sure yet"),
];

export const atlantaDiscoveryQuestions: readonly DiscoveryQuestion[] = [
  {
    key: "divorce_stage",
    module: "stage",
    type: "single_choice",
    label: "Current stage",
    prompt: "Where are you in the divorce process today?",
    why: "The right next step depends on whether a case has been filed or an order already exists.",
    classification: "legal",
    required: true,
    options: [
      option("considering", "Considering divorce or separation"),
      option("preparing", "Preparing to file"),
      option("filed", "A case has been filed"),
      option("negotiating", "Negotiating terms"),
      option("final_order", "A final divorce order exists"),
    ],
  },
  {
    key: "representation_status",
    module: "stage",
    type: "single_choice",
    label: "Legal representation",
    prompt: "Do you currently have a Georgia family law attorney?",
    why: "This helps distinguish information to organize from questions that require legal review.",
    classification: "legal",
    required: true,
    options: [
      option("represented", "Yes, I am represented"),
      option("consulting", "I am consulting attorneys"),
      option("self_represented", "No, I am currently self-represented"),
      option("unknown", "I have not decided"),
    ],
  },
  {
    key: "filing_jurisdiction_confirmed",
    module: "stage",
    type: "single_choice",
    label: "Court location",
    prompt:
      "Is the selected Superior Court the court connected to your case or expected filing?",
    why: "Atlanta spans multiple counties. Fulton and DeKalb Superior Courts have separate local processes.",
    classification: "legal",
    required: true,
    options: yesNoUnknown,
  },
  {
    key: "primary_goals",
    module: "stage",
    type: "text",
    label: "Priorities",
    prompt:
      "What are the most important outcomes or concerns you want your team to understand?",
    why: "Your priorities help organize the roadmap without turning your words into automated legal rules.",
    classification: "shared",
    required: false,
    placeholder:
      "For example: stable housing, a workable timeline, or understanding shared debts.",
  },
  {
    key: "filed_case_reference",
    module: "stage",
    type: "text",
    label: "Filed case reference",
    prompt:
      "What case number or filing reference appears on the court paperwork?",
    why: "A reference helps a professional connect supplied documents to the correct Georgia Superior Court matter.",
    classification: "legal",
    required: false,
    condition: {
      conditions: [
        { key: "divorce_stage", operator: "equals", value: "filed" },
        { key: "divorce_stage", operator: "equals", value: "negotiating" },
        { key: "divorce_stage", operator: "equals", value: "final_order" },
      ],
      operator: "any",
    },
    placeholder:
      "Use only the reference shown on synthetic or supplied case records.",
  },
  {
    key: "next_legal_date",
    module: "stage",
    type: "date",
    label: "Next known legal date",
    prompt: "Is there a known hearing, mediation, response, or filing date?",
    why: "Known dates help order the roadmap, but a Georgia attorney must confirm what the date requires.",
    classification: "legal",
    required: false,
    condition: {
      conditions: [
        { key: "divorce_stage", operator: "equals", value: "filed" },
        { key: "divorce_stage", operator: "equals", value: "negotiating" },
      ],
      operator: "any",
    },
  },

  {
    key: "safe_to_contact",
    module: "safety",
    type: "single_choice",
    label: "Safe communications",
    prompt:
      "Is it safe for Resurgo to display case notifications on this device?",
    why: "Safety choices should shape communications before any coordination begins.",
    classification: "health",
    required: true,
    options: [
      option("yes", "Yes"),
      option("limited", "Use limited, discreet notifications"),
      option("no", "No—do not display sensitive notification details"),
    ],
  },
  {
    key: "safety_concerns",
    module: "safety",
    type: "multiple_choice",
    label: "Safety considerations",
    prompt: "Are any of these safety or privacy considerations relevant?",
    why: "These answers remain restricted and are not automatically disclosed to professionals.",
    classification: "health",
    required: true,
    options: [
      option("none", "None of these"),
      option("device_monitoring", "Device or account monitoring concerns"),
      option("location_privacy", "Location or address privacy concerns"),
      option(
        "protective_order",
        "A protective order or safety-related court order",
      ),
      option("immediate_support", "I may need immediate safety support"),
    ],
  },
  {
    key: "confidential_contact_note",
    module: "safety",
    type: "text",
    label: "Communication note",
    prompt:
      "Is there anything Resurgo should account for when presenting communications?",
    why: "A short note can reduce unsafe or unwanted disclosure on this workspace.",
    classification: "health",
    required: false,
    condition: { key: "safe_to_contact", operator: "not_equals", value: "yes" },
    placeholder:
      "Do not enter emergency information. If you are in immediate danger, contact emergency services.",
  },

  {
    key: "has_dependents",
    module: "children",
    type: "single_choice",
    label: "Children or dependents",
    prompt: "Are children or other dependents affected by this transition?",
    why: "Parenting schedules and support may affect timing, housing, and required professional review.",
    classification: "legal",
    required: true,
    options: yesNoUnknown,
  },
  {
    key: "dependent_summary",
    module: "children",
    type: "structured_entities",
    label: "Dependents",
    prompt: "Add the dependents whose needs should be considered.",
    why: "Age range and relationship are enough for initial planning; avoid unnecessary identifying details.",
    classification: "legal",
    required: true,
    condition: { key: "has_dependents", operator: "equals", value: "yes" },
  },
  {
    key: "parenting_plan_status",
    module: "children",
    type: "single_choice",
    label: "Parenting arrangements",
    prompt: "Is there a parenting plan or temporary arrangement?",
    why: "Existing arrangements can affect housing logistics and attorney review.",
    classification: "legal",
    required: true,
    condition: { key: "has_dependents", operator: "equals", value: "yes" },
    options: [
      option("court_ordered", "A court-ordered plan exists"),
      option("written_informal", "A written informal arrangement exists"),
      option("verbal", "Only a verbal understanding exists"),
      option("none", "No arrangement yet"),
      option("unknown", "I’m not sure"),
    ],
  },
  {
    key: "support_expected",
    module: "children",
    type: "single_choice",
    label: "Support income",
    prompt:
      "Do you expect child or spousal support to be part of your future household income?",
    why: "Expected support used for housing should be reviewed by legal and mortgage professionals before relying on it.",
    classification: "financial",
    required: true,
    condition: { key: "has_dependents", operator: "equals", value: "yes" },
    options: yesNoUnknown,
  },

  {
    key: "property_status",
    module: "property",
    type: "single_choice",
    label: "Real property",
    prompt: "What real property is involved?",
    why: "Property ownership, occupancy, and mortgage liability are separate facts.",
    classification: "financial",
    required: true,
    options: [
      option("jointly_owned", "A home or property is jointly titled"),
      option("solely_owned_client", "Property is titled only to me"),
      option("solely_owned_spouse", "Property is titled only to my spouse"),
      option("multiple", "Multiple properties are involved"),
      option("no_real_property", "No real property is involved"),
      option("unknown", "I am not sure how title is held"),
    ],
  },
  {
    key: "housing_goal",
    module: "property",
    type: "single_choice",
    label: "Housing goal",
    prompt: "What housing outcome are you currently considering?",
    why: "This identifies coordination questions, not whether an outcome is legally or financially available.",
    classification: "financial",
    required: true,
    condition: {
      key: "property_status",
      operator: "not_equals",
      value: "no_real_property",
    },
    options: [
      option("retain", "I want to explore keeping the home"),
      option("leave", "I expect to leave the home"),
      option("sell", "Selling is being considered"),
      option("undecided", "I am undecided"),
      option("other_property", "The goal differs by property"),
    ],
  },
  {
    key: "title_holders",
    module: "property",
    type: "multiple_choice",
    label: "Title holders",
    prompt: "Who appears to hold title to the primary property?",
    why: "A title mismatch can require attorney review and should not be inferred from who pays the mortgage.",
    classification: "financial",
    required: true,
    condition: {
      key: "property_status",
      operator: "not_equals",
      value: "no_real_property",
    },
    options: [
      option("client", "Me"),
      option("spouse", "My spouse"),
      option("other", "Another person or entity"),
      option("unknown", "I need to verify title"),
    ],
  },
  {
    key: "estimated_home_value",
    module: "property",
    type: "currency",
    label: "Estimated value",
    prompt: "What is the current estimated value of the primary property?",
    why: "An estimate helps frame valuation questions but is not treated as an appraisal.",
    classification: "financial",
    required: false,
    condition: {
      key: "property_status",
      operator: "not_equals",
      value: "no_real_property",
    },
  },
  {
    key: "current_occupancy",
    module: "property",
    type: "single_choice",
    label: "Current occupancy",
    prompt: "Who currently lives in the primary property?",
    why: "Occupancy affects practical coordination, but it does not determine ownership or legal rights.",
    classification: "legal",
    required: true,
    condition: {
      key: "property_status",
      operator: "not_equals",
      value: "no_real_property",
    },
    options: [
      option("both", "Both spouses"),
      option("client", "Only me"),
      option("spouse", "Only my spouse"),
      option("neither", "Neither spouse"),
      option("varies", "It varies by property"),
    ],
  },
  {
    key: "property_transition_date",
    module: "property",
    type: "date",
    label: "Property transition date",
    prompt: "Has a move, listing, sale, or possession date been proposed?",
    why: "A proposed date can expose dependencies between housing, legal terms, and financing review.",
    classification: "financial",
    required: false,
    condition: {
      key: "property_status",
      operator: "not_equals",
      value: "no_real_property",
    },
  },

  {
    key: "mortgage_status",
    module: "mortgage",
    type: "single_choice",
    label: "Mortgage obligation",
    prompt:
      "Is a mortgage or home-equity obligation connected to the property?",
    why: "Loan liability can continue even when title or occupancy changes.",
    classification: "financial",
    required: true,
    condition: {
      key: "property_status",
      operator: "not_equals",
      value: "no_real_property",
    },
    options: yesNoUnknown,
  },
  {
    key: "mortgage_borrowers",
    module: "mortgage",
    type: "multiple_choice",
    label: "Borrowers",
    prompt: "Who is named on the mortgage obligation?",
    why: "Comparing borrowers with title holders surfaces questions for qualified legal and mortgage review.",
    classification: "financial",
    required: true,
    condition: { key: "mortgage_status", operator: "equals", value: "yes" },
    options: [
      option("client", "Me"),
      option("spouse", "My spouse"),
      option("other", "Another borrower"),
      option("unknown", "I need to verify the loan documents"),
    ],
  },
  {
    key: "mortgage_balance",
    module: "mortgage",
    type: "currency",
    label: "Estimated mortgage balance",
    prompt: "What is the approximate remaining balance?",
    why: "An estimate helps organize the property transition; a lender must verify actual balances and feasibility.",
    classification: "financial",
    required: false,
    condition: { key: "mortgage_status", operator: "equals", value: "yes" },
  },
  {
    key: "financing_goal",
    module: "mortgage",
    type: "single_choice",
    label: "Financing goal",
    prompt: "Which financing path do you want a specialist to help evaluate?",
    why: "Resurgo identifies review needs and does not make mortgage eligibility decisions.",
    classification: "financial",
    required: true,
    condition: {
      conditions: [
        { key: "mortgage_status", operator: "equals", value: "yes" },
        { key: "housing_goal", operator: "equals", value: "retain" },
      ],
      operator: "all",
    },
    options: [
      option("refinance", "Explore refinancing into my name"),
      option("assumption", "Ask whether loan assumption is available"),
      option("buyout", "Evaluate a possible equity buyout"),
      option("undecided", "I need help comparing paths"),
    ],
  },
  {
    key: "refinance_deadline",
    module: "mortgage",
    type: "date",
    label: "Proposed financing deadline",
    prompt:
      "Has anyone proposed a refinance, assumption, sale, or buyout deadline?",
    why: "Deadlines should be checked against legal terms and lender feasibility before being relied upon.",
    classification: "financial",
    required: false,
    condition: { key: "mortgage_status", operator: "equals", value: "yes" },
  },
  {
    key: "lender_review_status",
    module: "mortgage",
    type: "single_choice",
    label: "Lender review",
    prompt:
      "Has a qualified mortgage professional reviewed the proposed housing plan?",
    why: "A proposed settlement deadline is not the same as a lender feasibility review.",
    classification: "financial",
    required: true,
    condition: { key: "mortgage_status", operator: "equals", value: "yes" },
    options: [
      option("completed", "Yes, a review was completed"),
      option("scheduled", "A review is scheduled"),
      option("not_started", "No review has started"),
      option("unknown", "I’m not sure"),
    ],
  },
  {
    key: "mortgage_document",
    module: "mortgage",
    type: "document_reference",
    label: "Mortgage evidence",
    prompt:
      "Link an available mortgage statement or loan document, if one has been uploaded.",
    why: "Evidence references remain tied to an exact immutable document version.",
    classification: "financial",
    required: false,
    condition: { key: "mortgage_status", operator: "equals", value: "yes" },
  },

  {
    key: "income_sources",
    module: "financial",
    type: "multiple_choice",
    label: "Income sources",
    prompt: "Which income sources may matter to post-divorce planning?",
    why: "Different income sources may require different documentation and professional review.",
    classification: "financial",
    required: true,
    options: [
      option("employment", "Employment income"),
      option("self_employment", "Self-employment or business income"),
      option("support", "Expected support income"),
      option("investment", "Investment or rental income"),
      option("other", "Other income"),
      option("unknown", "I need help identifying income sources"),
    ],
  },
  {
    key: "support_income_amount",
    module: "financial",
    type: "currency",
    label: "Expected monthly support",
    prompt: "What monthly support amount is currently proposed or expected?",
    why: "This is recorded as an unverified planning fact, not a legal entitlement or qualifying income determination.",
    classification: "financial",
    required: false,
    condition: {
      conditions: [
        { key: "income_sources", operator: "includes", value: "support" },
        { key: "support_expected", operator: "equals", value: "yes" },
      ],
      operator: "any",
    },
  },
  {
    key: "monthly_household_income",
    module: "financial",
    type: "currency",
    label: "Current monthly household income",
    prompt:
      "What approximate monthly income is currently available to your household?",
    why: "This unverified planning estimate helps identify missing records; it is not a support, tax, or lending calculation.",
    classification: "financial",
    required: false,
  },
  {
    key: "asset_types",
    module: "financial",
    type: "multiple_choice",
    label: "Assets",
    prompt: "Which assets may require organization or review?",
    why: "This creates a document and professional review checklist without classifying property legally.",
    classification: "financial",
    required: true,
    options: [
      option("bank", "Bank accounts"),
      option("retirement", "Retirement accounts"),
      option("investments", "Investments"),
      option("real_property", "Real property"),
      option("business", "Business interests"),
      option("digital", "Digital assets"),
      option("none_known", "None known"),
      option("unknown", "I am uncertain what exists or how it is owned"),
    ],
  },
  {
    key: "debt_certainty",
    module: "financial",
    type: "single_choice",
    label: "Debts",
    prompt:
      "How confident are you that all significant debts have been identified?",
    why: "Uncertainty can trigger a document-gathering step and professional review rather than an automated conclusion.",
    classification: "financial",
    required: true,
    options: [
      option("confident", "I have a clear list"),
      option("partial", "I know some but may be missing others"),
      option("uncertain", "I am uncertain about debts or responsibility"),
    ],
  },
  {
    key: "liability_summary",
    module: "financial",
    type: "structured_entities",
    label: "Known liabilities",
    prompt:
      "Add the significant debts or continuing obligations you already know about.",
    why: "A structured list helps identify documents and ownership questions without deciding legal responsibility.",
    classification: "financial",
    required: false,
  },

  {
    key: "business_interest",
    module: "business",
    type: "single_choice",
    label: "Business ownership",
    prompt:
      "Does either spouse have an ownership interest in a business, partnership, or professional practice?",
    why: "Business interests may need valuation, income analysis, or tracing by qualified professionals.",
    classification: "financial",
    required: true,
    options: yesNoUnknown,
  },
  {
    key: "business_details",
    module: "business",
    type: "structured_entities",
    label: "Business interests",
    prompt: "Add each business interest that may require review.",
    why: "Initial details help scope review without treating a client estimate as a valuation.",
    classification: "financial",
    required: true,
    condition: { key: "business_interest", operator: "equals", value: "yes" },
  },
  {
    key: "valuation_status",
    module: "business",
    type: "single_choice",
    label: "Valuation",
    prompt: "Has a qualified professional valued the business interest?",
    why: "A professional valuation is distinct from book value or an owner estimate.",
    classification: "financial",
    required: true,
    condition: { key: "business_interest", operator: "equals", value: "yes" },
    options: [
      option("completed", "A current valuation exists"),
      option("outdated", "Only an older valuation exists"),
      option("not_started", "No valuation has started"),
      option("unknown", "I’m not sure"),
    ],
  },

  {
    key: "existing_orders",
    module: "orders",
    type: "multiple_choice",
    label: "Existing orders",
    prompt: "Which court orders or written terms currently exist?",
    why: "Existing terms can create deadlines or restrictions that require attorney interpretation.",
    classification: "legal",
    required: true,
    options: [
      option("none", "None known"),
      option("temporary_order", "Temporary order"),
      option("protective_order", "Protective order"),
      option("parenting_order", "Parenting or support order"),
      option("settlement_draft", "Draft or signed settlement terms"),
      option("final_order", "Final judgment and decree"),
      option("unknown", "I need help identifying current orders"),
    ],
  },
  {
    key: "order_document",
    module: "orders",
    type: "document_reference",
    label: "Order or settlement evidence",
    prompt: "Link an available order or settlement document, if uploaded.",
    why: "Professional review should reference the exact version supplied, not a mutable filename.",
    classification: "legal",
    required: false,
    condition: {
      key: "existing_orders",
      operator: "not_equals",
      value: ["none"],
    },
  },
  {
    key: "settlement_housing_condition",
    module: "orders",
    type: "single_choice",
    label: "Housing condition",
    prompt:
      "Do existing or proposed terms depend on a refinance, sale, buyout, or other unresolved financial condition?",
    why: "Conditional settlement terms should be reviewed by the relevant attorney and financial or mortgage professional.",
    classification: "legal",
    required: true,
    condition: {
      conditions: [
        {
          key: "existing_orders",
          operator: "includes",
          value: "settlement_draft",
        },
        { key: "divorce_stage", operator: "equals", value: "negotiating" },
      ],
      operator: "any",
    },
    options: yesNoUnknown,
  },

  {
    key: "desired_services",
    module: "support",
    type: "multiple_choice",
    label: "Professional services",
    prompt: "Which types of support would you like to explore?",
    why: "Selections create neutral coordination recommendations and never automatically share case information.",
    classification: "shared",
    required: true,
    options: [
      option("attorney", "Georgia family law attorney"),
      option("mortgage", "Divorce-informed mortgage specialist"),
      option("financial", "Financial planner or divorce financial specialist"),
      option("forensic", "Forensic accountant or valuation specialist"),
      option("personal", "Optional personal-support services"),
      option("none", "No additional services right now"),
    ],
  },
  {
    key: "transition_support_note",
    module: "support",
    type: "text",
    label: "Practical support",
    prompt:
      "What practical transition support would make the next few weeks easier?",
    why: "This helps organize optional support separately from legal and financial information.",
    classification: "shared",
    required: false,
    placeholder:
      "For example: moving coordination, budgeting support, or organizing appointments.",
  },
] as const;

function answerValue(answers: DiscoveryAnswers, key: string) {
  const answer = answers[key];
  return answer?.status === "answered" ? answer.value : undefined;
}

export function conditionMatches(
  condition: Condition,
  answers: DiscoveryAnswers,
): boolean {
  if ("conditions" in condition) {
    return condition.operator === "all"
      ? condition.conditions.every((item) => conditionMatches(item, answers))
      : condition.conditions.some((item) => conditionMatches(item, answers));
  }
  const value = answerValue(answers, condition.key);
  if (condition.operator === "includes")
    return Array.isArray(value) && value.includes(condition.value);
  if (condition.operator === "equals")
    return Array.isArray(condition.value)
      ? JSON.stringify(value) === JSON.stringify(condition.value)
      : value === condition.value;
  return Array.isArray(condition.value)
    ? JSON.stringify(value) !== JSON.stringify(condition.value)
    : value !== condition.value;
}

export function applicableDiscoveryQuestions(answers: DiscoveryAnswers) {
  return atlantaDiscoveryQuestions.filter(
    (question) =>
      !question.condition || conditionMatches(question.condition, answers),
  );
}

export function validateDiscoveryAnswerValue(
  question: DiscoveryQuestion,
  answer: DiscoveryAnswer,
) {
  if (["unknown", "not_applicable", "deferred"].includes(answer.status))
    return answer.value == null;
  if (answer.status !== "answered") return false;
  if (question.type === "single_choice")
    return (
      question.options?.some(({ value }) => value === answer.value) === true
    );
  if (question.type === "multiple_choice")
    return (
      Array.isArray(answer.value) &&
      answer.value.length > 0 &&
      answer.value.every(
        (value) =>
          typeof value === "string" &&
          question.options?.some((option) => option.value === value),
      )
    );
  if (question.type === "date")
    return (
      typeof answer.value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/u.test(answer.value)
    );
  if (question.type === "currency")
    return (
      typeof answer.value === "number" &&
      Number.isFinite(answer.value) &&
      answer.value >= 0
    );
  if (question.type === "text")
    return (
      typeof answer.value === "string" &&
      answer.value.trim().length > 0 &&
      answer.value.length <= 4000
    );
  if (question.type === "document_reference")
    return (
      typeof answer.value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
        answer.value,
      )
    );
  return (
    Array.isArray(answer.value) &&
    answer.value.length > 0 &&
    answer.value.length <= 20 &&
    answer.value.every(
      (entity) => typeof entity === "object" && entity !== null,
    )
  );
}
