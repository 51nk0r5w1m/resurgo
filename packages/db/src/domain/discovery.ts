import { createHash, randomUUID } from "node:crypto";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  discoveryAnswers,
  discoverySessions,
  recommendations,
  roadmapItems,
} from "../schema";
import {
  AuthorizationDeniedError,
  requireCaseAuthorization,
} from "./authorization";

export const discoveryQuestions = [
  {
    key: "property_status",
    prompt: "What best describes the home or real property involved?",
    options: [
      ["jointly_owned", "We own property together"],
      ["solely_owned", "Property is owned by one spouse"],
      ["no_real_property", "No real property is involved"],
    ],
  },
  {
    key: "mortgage_status",
    prompt: "Is there a mortgage connected to the property?",
    options: [
      ["yes", "Yes"],
      ["no", "No"],
      ["unknown", "I’m not sure"],
    ],
  },
  {
    key: "financial_complexity",
    prompt: "How would you describe the financial picture?",
    options: [
      ["straightforward", "Mostly straightforward"],
      ["complex", "Business, investments, or complex assets are involved"],
      ["unknown", "I need help understanding it"],
    ],
  },
  {
    key: "support_interest",
    prompt: "Would personal-support resources be useful?",
    options: [
      ["yes", "Yes, include optional support resources"],
      ["none", "Not right now"],
    ],
  },
] as const;

export type DiscoveryQuestionKey = (typeof discoveryQuestions)[number]["key"];
export type DiscoveryAnswers = Partial<Record<DiscoveryQuestionKey, string>>;

const allowedAnswers: Record<DiscoveryQuestionKey, readonly string[]> = {
  property_status: ["jointly_owned", "solely_owned", "no_real_property"],
  mortgage_status: ["yes", "no", "unknown"],
  financial_complexity: ["straightforward", "complex", "unknown"],
  support_interest: ["yes", "none"],
};

export function visibleDiscoveryQuestions(answers: DiscoveryAnswers) {
  return discoveryQuestions.filter(
    (question) =>
      question.key !== "mortgage_status" ||
      answers.property_status !== "no_real_property",
  );
}

export function validateDiscoveryAnswer(
  key: string,
  value: string,
): key is DiscoveryQuestionKey {
  return (
    key in allowedAnswers &&
    allowedAnswers[key as DiscoveryQuestionKey].includes(value)
  );
}

export function deterministicRecommendations(answers: DiscoveryAnswers) {
  const result: Array<{
    service:
      | "divorce_attorney"
      | "mortgage_specialist"
      | "financial_specialist"
      | "personal_support";
    title: string;
    explanation: string;
  }> = [
    {
      service: "divorce_attorney" as const,
      title: "Speak with a Georgia family law attorney",
      explanation:
        "A qualified Georgia attorney can review your situation, court process, and legal options. Resurgo does not provide legal advice.",
    },
  ];
  if (
    answers.property_status !== "no_real_property" &&
    answers.mortgage_status !== "no"
  ) {
    result.push({
      service: "mortgage_specialist",
      title: "Review the mortgage and property transition",
      explanation:
        "A divorce-informed mortgage specialist can explain financing paths and documentation needs. This is not an eligibility determination.",
    });
  }
  if (
    answers.property_status === "jointly_owned" ||
    answers.financial_complexity !== "straightforward"
  ) {
    result.push({
      service: "financial_specialist",
      title: "Organize the financial picture",
      explanation:
        "A qualified financial specialist can help organize property, liabilities, and planning questions for professional review.",
    });
  }
  if (answers.support_interest === "yes") {
    result.push({
      service: "personal_support",
      title: "Consider optional personal-support resources",
      explanation:
        "Optional support resources can help with the practical and personal strain of transition; they are separate from legal and financial advice.",
    });
  }
  return result;
}

function auditHash(value: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify({ ...value, nonce: randomUUID() }))
    .digest("hex");
}

async function latestAnswers(
  database: NodePgDatabase<typeof schema>,
  discoverySessionId: string,
) {
  const result = await database.execute<{
    answer: string;
    question_key: DiscoveryQuestionKey;
  }>(sql`
    select distinct on (question_key) question_key, answer #>> '{}' as answer
    from resurgo.discovery_answers
    where discovery_session_id = ${discoverySessionId}
    order by question_key, revision desc
  `);
  return Object.fromEntries(
    result.rows.map((row) => [row.question_key, row.answer]),
  ) as DiscoveryAnswers;
}

export async function getDiscoveryState(
  database: NodePgDatabase<typeof schema>,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "manage" });
  const [session] = await database
    .select()
    .from(discoverySessions)
    .where(eq(discoverySessions.caseId, input.caseId))
    .limit(1);
  if (!session) throw new AuthorizationDeniedError();
  const answers = await latestAnswers(database, session.id);
  const [latestRecommendation] = await database
    .select({ generation: recommendations.generation })
    .from(recommendations)
    .where(eq(recommendations.caseId, input.caseId))
    .orderBy(desc(recommendations.generation))
    .limit(1);
  const generation = latestRecommendation?.generation;
  const recommendationRows = generation
    ? await database
        .select()
        .from(recommendations)
        .where(
          and(
            eq(recommendations.caseId, input.caseId),
            eq(recommendations.generation, generation),
          ),
        )
        .orderBy(asc(recommendations.createdAt))
    : [];
  const roadmap = generation
    ? await database
        .select()
        .from(roadmapItems)
        .where(
          and(
            eq(roadmapItems.caseId, input.caseId),
            eq(roadmapItems.generation, generation),
          ),
        )
        .orderBy(asc(roadmapItems.position))
    : [];
  return { answers, recommendations: recommendationRows, roadmap, session };
}

export async function saveDiscoveryAnswer(
  database: NodePgDatabase<typeof schema>,
  input: {
    caseId: string;
    questionKey: string;
    userId: string;
    value: string;
  },
) {
  if (!validateDiscoveryAnswer(input.questionKey, input.value)) {
    throw new Error("Invalid discovery answer");
  }
  const questionKey = input.questionKey as DiscoveryQuestionKey;
  return database.transaction(async (transaction) => {
    await requireCaseAuthorization(transaction, {
      ...input,
      operation: "manage",
    });
    const sessionResult = await transaction.execute<{
      id: string;
      revision: number;
      status: string;
    }>(sql`
      select id, revision, status
      from resurgo.discovery_sessions
      where case_id = ${input.caseId}
      for update
    `);
    const session = sessionResult.rows[0];
    if (!session || session.status !== "in_progress") {
      throw new AuthorizationDeniedError();
    }
    const answers = await latestAnswers(transaction, session.id);
    const visibleKeys = visibleDiscoveryQuestions(answers).map(
      ({ key }) => key,
    );
    if (!visibleKeys.includes(questionKey)) {
      throw new Error("Discovery question is not applicable");
    }
    const revision = session.revision + 1;
    await transaction.insert(discoveryAnswers).values({
      discoverySessionId: session.id,
      questionKey,
      answer: input.value,
      revision,
    });
    await transaction
      .update(discoverySessions)
      .set({ revision, updatedAt: new Date() })
      .where(eq(discoverySessions.id, session.id));
    const correlationId = randomUUID();
    await transaction.insert(auditEvents).values({
      actorType: "user",
      actorUserId: input.userId,
      action: "discovery.answer.saved",
      resourceType: "discovery_session",
      resourceId: session.id,
      caseId: input.caseId,
      outcome: "success",
      correlationId,
      eventHash: auditHash({
        action: "discovery.answer.saved",
        actorUserId: input.userId,
        correlationId,
        questionKey,
        revision,
      }),
    });
    return { revision };
  });
}

export async function completeDiscovery(
  database: NodePgDatabase<typeof schema>,
  input: { caseId: string; userId: string },
) {
  return database.transaction(async (transaction) => {
    await requireCaseAuthorization(transaction, {
      ...input,
      operation: "manage",
    });
    const sessionResult = await transaction.execute<{
      completed_at: Date | null;
      id: string;
      revision: number;
      status: string;
    }>(sql`
      select id, revision, status, completed_at
      from resurgo.discovery_sessions
      where case_id = ${input.caseId}
      for update
    `);
    const session = sessionResult.rows[0];
    if (!session) throw new AuthorizationDeniedError();
    if (session.status === "completed") {
      return getDiscoveryState(transaction, input);
    }
    if (session.status !== "in_progress") {
      throw new Error("Discovery session is not in progress");
    }
    const answers = await latestAnswers(transaction, session.id);
    const visibleQuestions = visibleDiscoveryQuestions(answers);
    const visibleAnswers = Object.fromEntries(
      visibleQuestions
        .filter(({ key }) => answers[key] !== undefined)
        .map(({ key }) => [key, answers[key]]),
    );
    const missing = visibleQuestions
      .map(({ key }) => key)
      .filter((key) => answers[key] === undefined);
    if (missing.length > 0) throw new Error("Discovery is incomplete");

    const generation = session.revision;
    const generated = deterministicRecommendations(visibleAnswers);
    const createdRecommendations = await transaction
      .insert(recommendations)
      .values(
        generated.map((item) => ({
          caseId: input.caseId,
          discoverySessionId: session.id,
          explanation: item.explanation,
          generation,
          ruleVersion: "atlanta-pilot-v1",
          service: item.service,
        })),
      )
      .returning();
    await transaction.insert(roadmapItems).values(
      createdRecommendations.map((recommendation, index) => ({
        caseId: input.caseId,
        recommendationId: recommendation.id,
        generation,
        position: index + 1,
        title: generated[index]!.title,
        description: recommendation.explanation,
        status: index === 0 ? ("ready" as const) : ("upcoming" as const),
      })),
    );
    const completedAt = new Date();
    await transaction
      .update(discoverySessions)
      .set({ status: "completed", completedAt, updatedAt: completedAt })
      .where(eq(discoverySessions.id, session.id));
    const correlationId = randomUUID();
    await transaction.insert(auditEvents).values({
      actorType: "user",
      actorUserId: input.userId,
      action: "discovery.completed",
      resourceType: "discovery_session",
      resourceId: session.id,
      caseId: input.caseId,
      outcome: "success",
      correlationId,
      eventHash: auditHash({
        action: "discovery.completed",
        actorUserId: input.userId,
        correlationId,
        generation,
      }),
    });
    return getDiscoveryState(transaction, input);
  });
}
