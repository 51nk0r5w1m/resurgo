"use client";

import { type FormEvent, useMemo, useState } from "react";

type Question = {
  key: string;
  prompt: string;
  options: ReadonlyArray<readonly [string, string]>;
};
type Recommendation = { id: string; service: string; explanation: string };
type RoadmapItem = {
  id: string;
  position: number;
  title: string;
  description: string;
  status: string;
};

export function DiscoveryInterview({
  caseId,
  initialAnswers,
  initialRecommendations,
  initialRoadmap,
  questions,
}: {
  caseId: string;
  initialAnswers: Record<string, string>;
  initialRecommendations: Recommendation[];
  initialRoadmap: RoadmapItem[];
  questions: Question[];
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [recommendations, setRecommendations] = useState(
    initialRecommendations,
  );
  const [roadmap, setRoadmap] = useState(initialRoadmap);
  const [message, setMessage] = useState("");
  const visible = useMemo(
    () =>
      questions.filter(
        ({ key }) =>
          key !== "mortgage_status" ||
          answers.property_status !== "no_real_property",
      ),
    [answers, questions],
  );
  const current = visible.find(({ key }) => answers[key] === undefined);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    const value = String(new FormData(event.currentTarget).get("answer") ?? "");
    let response: Response;
    try {
      response = await fetch(`/api/cases/${caseId}/discovery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          questionKey: current.key,
          value,
        }),
      });
    } catch {
      setMessage("That answer could not be saved.");
      return;
    }
    if (!response.ok) {
      setMessage("That answer could not be saved.");
      return;
    }
    setAnswers((existing) => ({ ...existing, [current.key]: value }));
    setMessage("Saved privately. You can return and resume at any time.");
  }

  async function complete() {
    const response = await fetch(`/api/cases/${caseId}/discovery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (!response.ok) {
      setMessage(
        "Complete each applicable question before building the roadmap.",
      );
      return;
    }
    const result = (await response.json()) as {
      state: { recommendations: Recommendation[]; roadmap: RoadmapItem[] };
    };
    setRecommendations(result.state.recommendations);
    setRoadmap(result.state.roadmap);
    setMessage("Your personalized roadmap is ready.");
  }

  if (roadmap.length > 0) {
    return (
      <div className="journey-results">
        <section>
          <p className="eyebrow">Recommended professional services</p>
          <h2>Your coordination team, explained</h2>
          <div className="recommendation-list">
            {recommendations.map((recommendation) => (
              <article key={recommendation.id}>
                <h3>{recommendation.service.replaceAll("_", " ")}</h3>
                <p>{recommendation.explanation}</p>
              </article>
            ))}
          </div>
        </section>
        <section>
          <p className="eyebrow">Personalized transition roadmap</p>
          <h2>One place for every next step.</h2>
          <ol className="roadmap-list">
            {roadmap.map((item) => (
              <li key={item.id}>
                <span>{item.position}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="legal-note">
            These deterministic suggestions organize possible next steps. They
            are not legal advice, a mortgage eligibility decision, or a
            substitute for review by qualified professionals.
          </p>
        </section>
      </div>
    );
  }

  return (
    <section className="interview-card">
      <div
        className="progress-track"
        aria-label={`${Object.keys(answers).length} answers saved`}
      >
        <span
          style={{
            width: `${(Object.keys(answers).length / visible.length) * 100}%`,
          }}
        />
      </div>
      {current ? (
        <form onSubmit={save}>
          <p className="eyebrow">Guided discovery</p>
          <h2>{current.prompt}</h2>
          <fieldset>
            <legend className="sr-only">Choose one answer</legend>
            {current.options.map(([value, label]) => (
              <label className="answer-option" key={value}>
                <input name="answer" required type="radio" value={value} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <button className="button button-primary" type="submit">
            Save and continue
          </button>
        </form>
      ) : (
        <div>
          <p className="eyebrow">Discovery saved</p>
          <h2>Build your first roadmap</h2>
          <p>
            Resurgo will apply transparent Atlanta pilot rules to your answers.
          </p>
          <button
            className="button button-primary"
            onClick={complete}
            type="button"
          >
            Build my roadmap
          </button>
        </div>
      )}
      <div aria-live="polite" className="form-message">
        {message}
      </div>
    </section>
  );
}
