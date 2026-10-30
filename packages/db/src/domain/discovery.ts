import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  discoveryAnswers,
  discoveryOutputs,
  discoverySessions,
  recommendations,
  roadmapItems,
} from "../schema";
import {
  AuthorizationDeniedError,
  hasEffectiveResourceAccess,
  requireCaseAuthorization,
} from "./authorization";
import { buildAuditEvent } from "./audit";
import {
  applicableDiscoveryQuestions,
  ATLANTA_DISCOVERY_VERSION,
  atlantaDiscoveryQuestions,
  discoveryModules,
  validateDiscoveryAnswerValue,
  type DiscoveryAnswer,
  type DiscoveryAnswers,
} from "./discovery-definition";
import { evaluateDiscoveryRules } from "./discovery-rules";

type Database = NodePgDatabase<typeof schema>;

export {
  applicableDiscoveryQuestions,
  ATLANTA_DISCOVERY_VERSION,
  atlantaDiscoveryQuestions,
  discoveryModules,
  evaluateDiscoveryRules,
};
export type {
  DiscoveryAnswer,
  DiscoveryAnswers,
  DiscoveryModuleKey,
  DiscoveryQuestion,
} from "./discovery-definition";

function questionFor(key: string) {
  return atlantaDiscoveryQuestions.find((question) => question.key === key);
}

async function latestAnswers(
  database: Database,
  discoverySessionId: string,
): Promise<DiscoveryAnswers> {
  const result = await database.execute<{
    answer: unknown;
    answer_status: DiscoveryAnswer["status"];
    document_version_id: string | null;
    question_key: string;
    source: DiscoveryAnswer["source"];
    verification_status: DiscoveryAnswer["verificationStatus"];
  }>(sql`
    select distinct on (question_key)
      question_key, answer, answer_status, source, verification_status,
      document_version_id
    from resurgo.discovery_answers
    where discovery_session_id = ${discoverySessionId}
    order by question_key, revision desc, created_at desc
  `);
  return Object.fromEntries(
    result.rows.map((row) => [
      row.question_key,
      {
        ...(row.document_version_id
          ? { documentVersionId: row.document_version_id }
          : {}),
        source: row.source,
        status: row.answer_status,
        value: row.answer_status === "answered" ? row.answer : null,
        verificationStatus: row.verification_status,
      } satisfies DiscoveryAnswer,
    ]),
  );
}

async function requireDocumentReference(
  database: Database,
  input: { caseId: string; userId: string; versionId: string },
) {
  const result = await database.execute<{
    resource_id: string;
    status: string;
  }>(sql`
    select document.case_resource_id as resource_id,
      (
        select event.status
        from resurgo.document_processing_events event
        where event.case_id = version.case_id
          and event.document_id = version.document_id
          and event.document_version_id = version.id
        order by event.occurred_at desc, event.id desc
        limit 1
      ) as status
    from resurgo.document_versions version
    inner join resurgo.documents document
      on document.case_id = version.case_id
      and document.id = version.document_id
    where version.case_id = ${input.caseId}
      and version.id = ${input.versionId}
    limit 1
  `);
  const reference = result.rows[0];
  if (
    !reference ||
    reference.status !== "available" ||
    !(await hasEffectiveResourceAccess(database, {
      caseId: input.caseId,
      operation: "view",
      resourceId: reference.resource_id,
      userId: input.userId,
    }))
  ) {
    throw new AuthorizationDeniedError();
  }
}

export async function getDiscoveryState(
  database: Database,
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
  const [latestOutput] = await database
    .select({ generation: discoveryOutputs.generation })
    .from(discoveryOutputs)
    .where(eq(discoveryOutputs.caseId, input.caseId))
    .orderBy(desc(discoveryOutputs.generation))
    .limit(1);
  const generation = Math.max(
    latestRecommendation?.generation ?? 0,
    latestOutput?.generation ?? 0,
  );
  const [recommendationRows, outputRows, roadmap] = generation
    ? await Promise.all([
        database
          .select()
          .from(recommendations)
          .where(
            and(
              eq(recommendations.caseId, input.caseId),
              eq(recommendations.generation, generation),
            ),
          )
          .orderBy(asc(recommendations.createdAt)),
        database
          .select()
          .from(discoveryOutputs)
          .where(
            and(
              eq(discoveryOutputs.caseId, input.caseId),
              eq(discoveryOutputs.generation, generation),
            ),
          )
          .orderBy(asc(discoveryOutputs.createdAt)),
        database
          .select()
          .from(roadmapItems)
          .where(
            and(
              eq(roadmapItems.caseId, input.caseId),
              eq(roadmapItems.generation, generation),
            ),
          )
          .orderBy(asc(roadmapItems.position)),
      ])
    : [[], [], []];
  return {
    answers,
    applicableQuestionKeys: applicableDiscoveryQuestions(answers).map(
      ({ key }) => key,
    ),
    outputs: outputRows,
    recommendations: recommendationRows,
    roadmap,
    session,
  };
}

export async function saveDiscoveryAnswer(
  database: Database,
  input: {
    answer: DiscoveryAnswer;
    caseId: string;
    questionKey: string;
    userId: string;
  },
) {
  const question = questionFor(input.questionKey);
  if (!question || !validateDiscoveryAnswerValue(question, input.answer)) {
    throw new Error("Invalid discovery answer");
  }
  if (input.answer.source !== "client_reported") {
    throw new AuthorizationDeniedError();
  }
  return database.transaction(async (transaction) => {
    await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const sessionResult = await transaction.execute<{
      definition_version: string;
      id: string;
      revision: number;
      status: string;
    }>(sql`
      select id, revision, status, definition_version
      from resurgo.discovery_sessions
      where case_id = ${input.caseId}
      for update
    `);
    const session = sessionResult.rows[0];
    if (!session || session.status !== "in_progress") {
      throw new AuthorizationDeniedError();
    }
    if (session.definition_version !== ATLANTA_DISCOVERY_VERSION) {
      throw new Error("Discovery definition version is not supported");
    }
    const answers = await latestAnswers(transaction, session.id);
    if (
      !applicableDiscoveryQuestions(answers).some(
        ({ key }) => key === question.key,
      )
    ) {
      throw new Error("Discovery question is not applicable");
    }
    if (
      question.type === "document_reference" &&
      input.answer.status === "answered"
    ) {
      await requireDocumentReference(transaction, {
        caseId: input.caseId,
        userId: input.userId,
        versionId: String(input.answer.value),
      });
    }
    const revision = session.revision + 1;
    await transaction.insert(discoveryAnswers).values({
      // Preserve the row without writing SQL NULL to the non-null JSONB
      // column. latestAnswers intentionally exposes null for non-answer states.
      answer: input.answer.status === "answered" ? input.answer.value : {},
      answerStatus: input.answer.status,
      classification: question.classification,
      definitionVersion: ATLANTA_DISCOVERY_VERSION,
      discoverySessionId: session.id,
      documentVersionId:
        question.type === "document_reference" &&
        input.answer.status === "answered"
          ? String(input.answer.value)
          : undefined,
      questionKey: question.key,
      revision,
      source: input.answer.source,
      verificationStatus: input.answer.verificationStatus,
    });
    await transaction
      .update(discoverySessions)
      .set({ revision, updatedAt: new Date() })
      .where(eq(discoverySessions.id, session.id));
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "discovery.answer.saved",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: session.id,
        resourceType: "discovery_session",
      }),
    );
    return { revision };
  });
}

function roadmapFor(
  generated: ReturnType<typeof evaluateDiscoveryRules>,
  createdRecommendations: Array<{ id: string; service: string }>,
) {
  const serviceItems = generated.recommendations.map((item) => ({
    description: item.explanation,
    recommendationId: createdRecommendations.find(
      ({ service }) => service === item.service,
    )?.id,
    title: item.title,
  }));
  const documentItems = generated.outputs
    .filter(({ type }) => type === "document_request")
    .map((item) => ({
      description: `${item.explanation} Triggered by ${item.ruleId}.`,
      recommendationId: undefined,
      title: `Gather: ${item.title}`,
    }));
  const reviewItems = generated.outputs
    .filter(({ type }) => type === "review_trigger")
    .map((item) => ({
      description: `${item.explanation} Triggered by ${item.ruleId}.`,
      recommendationId: undefined,
      title: `Resolve: ${item.title}`,
    }));
  return [...serviceItems, ...documentItems, ...reviewItems];
}

export async function completeDiscovery(
  database: Database,
  input: { caseId: string; userId: string },
) {
  return database.transaction(async (transaction) => {
    await requireCaseAuthorization(transaction, {
      ...input,
      operation: "manage",
    });
    const sessionResult = await transaction.execute<{
      definition_version: string;
      id: string;
      revision: number;
      status: string;
    }>(sql`
      select id, revision, status, definition_version
      from resurgo.discovery_sessions
      where case_id = ${input.caseId}
      for update
    `);
    const session = sessionResult.rows[0];
    if (!session) throw new AuthorizationDeniedError();
    if (session.status === "completed") {
      return getDiscoveryState(transaction, input);
    }
    if (
      session.status !== "in_progress" ||
      session.definition_version !== ATLANTA_DISCOVERY_VERSION
    ) {
      throw new Error("Discovery session is not completable");
    }
    const answers = await latestAnswers(transaction, session.id);
    const applicable = applicableDiscoveryQuestions(answers);
    const missing = applicable
      .filter(({ required }) => required)
      .filter(({ key }) => answers[key] === undefined)
      .map(({ key }) => key);
    if (missing.length > 0) throw new Error("Discovery is incomplete");

    const generated = evaluateDiscoveryRules(answers);
    const generation = session.revision;
    const createdRecommendations = await transaction
      .insert(recommendations)
      .values(
        generated.recommendations.map((item) => ({
          caseId: input.caseId,
          discoverySessionId: session.id,
          explanation: item.explanation,
          generation,
          ruleVersion: ATLANTA_DISCOVERY_VERSION,
          service: item.service,
        })),
      )
      .returning({ id: recommendations.id, service: recommendations.service });
    if (generated.outputs.length > 0) {
      await transaction.insert(discoveryOutputs).values(
        generated.outputs.map((item) => ({
          caseId: input.caseId,
          classification: item.classification,
          code: item.code,
          discoverySessionId: session.id,
          explanation: item.explanation,
          generation,
          ruleId: item.ruleId,
          title: item.title,
          type: item.type,
        })),
      );
    }
    const roadmap = roadmapFor(generated, createdRecommendations);
    if (roadmap.length > 0) {
      await transaction.insert(roadmapItems).values(
        roadmap.map((item, index) => ({
          caseId: input.caseId,
          description: item.description,
          generation,
          position: index + 1,
          recommendationId: item.recommendationId,
          status: index === 0 ? ("ready" as const) : ("upcoming" as const),
          title: item.title,
        })),
      );
    }
    const completedAt = new Date();
    await transaction
      .update(discoverySessions)
      .set({ completedAt, status: "completed", updatedAt: completedAt })
      .where(eq(discoverySessions.id, session.id));
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "discovery.completed",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: session.id,
        resourceType: "discovery_session",
      }),
    );
    return getDiscoveryState(transaction, input);
  });
}
