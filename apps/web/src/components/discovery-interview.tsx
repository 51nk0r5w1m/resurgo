"use client";

import { Check, ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

import { isRequiredAnswerComplete } from "../lib/discovery-answer-status";

type AnswerStatus = "answered" | "unknown" | "not_applicable" | "deferred";
type Answer = {
  documentVersionId?: string;
  source: string;
  status: AnswerStatus;
  value: unknown;
  verificationStatus: string;
};
type Condition =
  | { key: string; operator: "equals" | "not_equals"; value: unknown }
  | { key: string; operator: "includes"; value: string }
  | { conditions: Condition[]; operator: "all" | "any" };
type Question = {
  classification: string;
  condition?: Condition;
  help?: string;
  key: string;
  label: string;
  module: string;
  options?: ReadonlyArray<{ label: string; value: string }>;
  placeholder?: string;
  prompt: string;
  required: boolean;
  type:
    | "single_choice"
    | "multiple_choice"
    | "date"
    | "currency"
    | "text"
    | "structured_entities"
    | "document_reference";
  why: string;
};
type Module = { description: string; key: string; title: string };
type Recommendation = { id: string; service: string; explanation: string };
type Output = {
  id: string;
  code: string;
  explanation: string;
  ruleId: string;
  title: string;
  type: "document_request" | "review_trigger";
};
type RoadmapItem = {
  id: string;
  position: number;
  title: string;
  description: string;
  status: string;
};
type DocumentOption = {
  title: string;
  versionId: string;
  versionNumber: number;
};

function answerValue(answers: Record<string, Answer | undefined>, key: string) {
  const answer = answers[key];
  return answer?.status === "answered" ? answer.value : undefined;
}

function conditionMatches(
  condition: Condition,
  answers: Record<string, Answer | undefined>,
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

function answerLabel(question: Question, answer: Answer) {
  if (answer.status !== "answered") return answer.status.replaceAll("_", " ");
  if (question.type === "single_choice")
    return (
      question.options?.find(({ value }) => value === answer.value)?.label ??
      String(answer.value)
    );
  if (question.type === "multiple_choice" && Array.isArray(answer.value))
    return answer.value
      .map(
        (value) =>
          question.options?.find((option) => option.value === value)?.label ??
          value,
      )
      .join(", ");
  if (question.type === "currency" && typeof answer.value === "number")
    return new Intl.NumberFormat("en-US", {
      currency: "USD",
      style: "currency",
      maximumFractionDigits: 0,
    }).format(answer.value);
  if (question.type === "structured_entities" && Array.isArray(answer.value))
    return answer.value
      .map((item) =>
        typeof item === "object" && item && "summary" in item
          ? String(item.summary)
          : "Structured item",
      )
      .join("; ");
  return String(answer.value);
}

function QuestionControl({
  answer,
  documents,
  question,
}: {
  answer: Answer | undefined;
  documents: DocumentOption[];
  question: Question;
}) {
  const value = answer?.status === "answered" ? answer.value : undefined;
  if (question.type === "single_choice") {
    return (
      <fieldset className="discovery-options">
        <legend className="sr-only">Choose one answer</legend>
        {question.options?.map((option) => (
          <label className="answer-option" key={option.value}>
            <input
              defaultChecked={value === option.value}
              name="value"
              required
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (question.type === "multiple_choice") {
    return (
      <fieldset className="discovery-options multi-choice-options">
        <legend className="sr-only">Choose every answer that applies</legend>
        {question.options?.map((option) => (
          <label className="answer-option" key={option.value}>
            <input
              defaultChecked={
                Array.isArray(value) && value.includes(option.value)
              }
              name="value"
              type="checkbox"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    );
  }
  if (question.type === "document_reference") {
    return (
      <label className="discovery-field">
        <span>Available document version</span>
        <select defaultValue={String(value ?? "")} name="value" required>
          <option disabled value="">
            Select an available document
          </option>
          {documents.map((document) => (
            <option key={document.versionId} value={document.versionId}>
              {document.title} · version {document.versionNumber}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (question.type === "structured_entities") {
    const initial = Array.isArray(value)
      ? value
          .map((item) =>
            typeof item === "object" && item && "summary" in item
              ? String(item.summary)
              : "",
          )
          .filter(Boolean)
          .join("\n")
      : "";
    return (
      <label className="discovery-field">
        <span>One item per line</span>
        <textarea
          defaultValue={initial}
          name="value"
          placeholder="Add only the details needed for initial coordination."
          required
          rows={5}
        />
      </label>
    );
  }
  return (
    <label className="discovery-field">
      <span>{question.label}</span>
      {question.type === "text" ? (
        <textarea
          defaultValue={String(value ?? "")}
          maxLength={4000}
          name="value"
          placeholder={question.placeholder}
          required
          rows={5}
        />
      ) : (
        <input
          defaultValue={value == null ? "" : String(value)}
          min={question.type === "currency" ? 0 : undefined}
          name="value"
          required
          step={question.type === "currency" ? "0.01" : undefined}
          type={question.type === "currency" ? "number" : "date"}
        />
      )}
    </label>
  );
}

export function DiscoveryInterview({
  caseId,
  documents,
  initialAnswers,
  initialOutputs,
  initialRecommendations,
  initialRoadmap,
  initialStatus,
  modules,
  questions,
}: {
  caseId: string;
  documents: DocumentOption[];
  initialAnswers: Record<string, Answer | undefined>;
  initialOutputs: Output[];
  initialRecommendations: Recommendation[];
  initialRoadmap: RoadmapItem[];
  initialStatus: "in_progress" | "completed";
  modules: Module[];
  questions: Question[];
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [recommendations, setRecommendations] = useState(
    initialRecommendations,
  );
  const [outputs, setOutputs] = useState(initialOutputs);
  const [roadmap, setRoadmap] = useState(initialRoadmap);
  const [status, setStatus] = useState(initialStatus);
  const [currentKey, setCurrentKey] = useState<string | null>(() => {
    const applicable = questions.filter(
      ({ condition }) =>
        !condition || conditionMatches(condition, initialAnswers),
    );
    return applicable.find(({ key }) => !initialAnswers[key])?.key ?? null;
  });
  const [reviewing, setReviewing] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const applicable = useMemo(
    () =>
      questions.filter(
        ({ condition }) => !condition || conditionMatches(condition, answers),
      ),
    [answers, questions],
  );
  const currentIndex = Math.max(
    0,
    applicable.findIndex(({ key }) => key === currentKey),
  );
  const current = applicable[currentIndex];
  const answeredCount = applicable.filter(({ key }) => answers[key]).length;
  const requiredMissing = applicable.filter(
    ({ key, required }) => required && !isRequiredAnswerComplete(answers[key]),
  );

  function move(offset: number) {
    const candidate = applicable[currentIndex + offset];
    if (candidate) {
      setReviewing(false);
      setCurrentKey(candidate.key);
    } else if (offset > 0) {
      setReviewing(true);
      setCurrentKey(null);
    }
  }

  async function persist(
    question: Question,
    answer: { status: AnswerStatus; value: unknown },
  ) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/cases/${caseId}/discovery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          answer,
          questionKey: question.key,
        }),
      });
      if (!response.ok) throw new Error("save failed");
      const saved: Answer = {
        source: "client_reported",
        status: answer.status,
        value: answer.status === "answered" ? answer.value : null,
        verificationStatus: "client_confirmed",
      };
      setAnswers((existing) => ({ ...existing, [question.key]: saved }));
      setMessage("Saved privately. You can return and resume at any time.");
      if (editingFromReview) {
        setEditingFromReview(false);
        setCurrentKey(null);
        setReviewing(true);
        return;
      }
      const nextAnswers = { ...answers, [question.key]: saved };
      const nextApplicable = questions.filter(
        ({ condition }) =>
          !condition || conditionMatches(condition, nextAnswers),
      );
      const next =
        nextApplicable.findIndex(({ key }) => key === question.key) + 1;
      if (next < nextApplicable.length)
        setCurrentKey(nextApplicable[next]!.key);
      else {
        setCurrentKey(null);
        setReviewing(true);
      }
    } catch {
      setMessage(
        "That answer could not be saved. Your previous answers remain intact.",
      );
    } finally {
      setPending(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const form = new FormData(event.currentTarget);
    let value: unknown;
    if (current.type === "multiple_choice")
      value = form.getAll("value").map(String);
    else if (current.type === "currency") value = Number(form.get("value"));
    else if (current.type === "structured_entities")
      value = String(form.get("value") ?? "")
        .split("\n")
        .map((summary) => summary.trim())
        .filter(Boolean)
        .map((summary) => ({ summary }));
    else value = String(form.get("value") ?? "").trim();
    await persist(current, { status: "answered", value });
  }

  async function complete() {
    setPending(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/discovery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      if (!response.ok) throw new Error("complete failed");
      const result = (await response.json()) as {
        state: {
          outputs: Output[];
          recommendations: Recommendation[];
          roadmap: RoadmapItem[];
        };
      };
      setOutputs(result.state.outputs);
      setRecommendations(result.state.recommendations);
      setRoadmap(result.state.roadmap);
      setStatus("completed");
      setMessage("Your personalized plan is ready.");
    } catch {
      setMessage(
        "Finish each required applicable question before submitting discovery.",
      );
    } finally {
      setPending(false);
    }
  }

  if (status === "completed") {
    const documentRequests = outputs.filter(
      ({ type }) => type === "document_request",
    );
    const reviewTriggers = outputs.filter(
      ({ type }) => type === "review_trigger",
    );
    return (
      <div className="discovery-results-grid">
        <section className="workspace-card discovery-result-hero">
          <p className="eyebrow">Discovery complete</p>
          <h2>Your personalized coordination plan</h2>
          <p>
            Each item below comes from a versioned, deterministic rule. It
            organizes next steps and does not make legal or mortgage eligibility
            decisions.
          </p>
        </section>
        <section className="workspace-card">
          <p className="eyebrow">Recommended professional services</p>
          <div className="recommendation-list">
            {recommendations.map((recommendation) => (
              <article key={recommendation.id}>
                <h3>{recommendation.service.replaceAll("_", " ")}</h3>
                <p>{recommendation.explanation}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="workspace-card">
          <p className="eyebrow">Documents to gather</p>
          <ul className="discovery-output-list">
            {documentRequests.map((item) => (
              <li key={item.id}>
                <Check aria-hidden="true" size={17} />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.explanation}</p>
                  <small>{item.ruleId}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="workspace-card">
          <p className="eyebrow">Professional review triggers</p>
          {reviewTriggers.length ? (
            <ul className="discovery-output-list">
              {reviewTriggers.map((item) => (
                <li key={item.id}>
                  <LockKeyhole aria-hidden="true" size={17} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.explanation}</p>
                    <small>{item.ruleId}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No specialist review trigger was identified from the facts
              supplied.
            </p>
          )}
        </section>
        <section className="workspace-card discovery-roadmap-card">
          <p className="eyebrow">Personalized roadmap</p>
          <ol className="roadmap-list workspace-roadmap">
            {roadmap.map((item) => (
              <li key={item.id}>
                <span>{item.position}</span>
                <div>
                  <small>{item.status}</small>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  }

  return (
    <div className="adaptive-interview-shell">
      <aside className="discovery-module-rail" aria-label="Discovery sections">
        {modules.map((module, index) => {
          const moduleQuestions = applicable.filter(
            ({ module: key }) => key === module.key,
          );
          const saved = moduleQuestions.filter(
            ({ key }) => answers[key],
          ).length;
          const active = current?.module === module.key;
          return (
            <button
              className={active ? "active" : ""}
              disabled={!moduleQuestions.length}
              key={module.key}
              onClick={() => {
                const target =
                  moduleQuestions.find(({ key }) => !answers[key]) ??
                  moduleQuestions[0];
                if (target) {
                  setCurrentKey(target.key);
                  setReviewing(false);
                }
              }}
              type="button"
            >
              <span>
                {saved === moduleQuestions.length && saved > 0 ? (
                  <Check size={14} />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{module.title}</strong>
                <small>
                  {saved} of {moduleQuestions.length}
                </small>
              </div>
            </button>
          );
        })}
      </aside>
      <section className="interview-card adaptive-interview-card">
        <header className="interview-progress-header">
          <div>
            <p>
              Step {Math.min(currentIndex + 1, applicable.length)} of{" "}
              {applicable.length} applicable questions
            </p>
            <div
              className="progress-track"
              aria-label={`${answeredCount} of ${applicable.length} applicable questions saved`}
            >
              <span
                style={{
                  width: `${applicable.length ? (answeredCount / applicable.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
          <strong>
            {Math.round((answeredCount / Math.max(applicable.length, 1)) * 100)}
            %
          </strong>
        </header>
        {reviewing || !current ? (
          <div className="discovery-review">
            <p className="eyebrow">Review before submission</p>
            <h2>Confirm what Resurgo will use.</h2>
            <p>
              Correct any answer before generating recommendations. Hidden
              branch answers are retained in history but are not used.
            </p>
            {modules.map((module) => {
              const items = applicable.filter(
                (question) =>
                  question.module === module.key && answers[question.key],
              );
              if (!items.length) return null;
              return (
                <section key={module.key}>
                  <h3>{module.title}</h3>
                  <dl className="answer-review">
                    {items.map((question) => (
                      <div key={question.key}>
                        <dt>{question.prompt}</dt>
                        <dd>{answerLabel(question, answers[question.key]!)}</dd>
                        <button
                          className="text-button"
                          onClick={() => {
                            setEditingFromReview(true);
                            setCurrentKey(question.key);
                            setReviewing(false);
                          }}
                          type="button"
                        >
                          Change
                        </button>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
            {requiredMissing.length > 0 && (
              <p className="form-message">
                {requiredMissing.length} required applicable question
                {requiredMissing.length === 1 ? " remains" : "s remain"}.
              </p>
            )}
            <button
              className="button button-primary"
              disabled={pending || requiredMissing.length > 0}
              onClick={complete}
              type="button"
            >
              {pending ? "Building your plan…" : "Submit and build my plan"}
            </button>
          </div>
        ) : (
          <form key={current.key} onSubmit={save}>
            <p className="eyebrow">
              {modules.find(({ key }) => key === current.module)?.title}
            </p>
            <h2>{current.prompt}</h2>
            <div
              className={`question-context context-${current.classification}`}
            >
              <LockKeyhole aria-hidden="true" size={18} />
              <div>
                <strong>Why we ask</strong>
                <p>{current.why}</p>
              </div>
            </div>
            <QuestionControl
              answer={answers[current.key]}
              documents={documents}
              question={current}
            />
            <div
              className="answer-status-actions"
              aria-label="Alternative answer status"
            >
              <span>Can’t answer now?</span>
              <button
                disabled={pending}
                onClick={() =>
                  persist(current, { status: "unknown", value: null })
                }
                type="button"
              >
                I don’t know
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  persist(current, { status: "not_applicable", value: null })
                }
                type="button"
              >
                Not applicable
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  persist(current, { status: "deferred", value: null })
                }
                type="button"
              >
                Decide later
              </button>
            </div>
            <footer className="interview-actions">
              <button
                className="button button-secondary"
                disabled={currentIndex === 0 || pending}
                onClick={() => move(-1)}
                type="button"
              >
                <ChevronLeft size={17} /> Back
              </button>
              <button
                className="button button-primary"
                disabled={pending}
                type="submit"
              >
                {pending ? "Saving…" : "Save and continue"}{" "}
                <ChevronRight size={17} />
              </button>
            </footer>
          </form>
        )}
        <div aria-live="polite" className="form-message">
          {message}
        </div>
      </section>
    </div>
  );
}
