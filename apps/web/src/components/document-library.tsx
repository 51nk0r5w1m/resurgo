"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type LibraryDocument = {
  byte_size: number;
  classification: string;
  confidentiality: string;
  document_id: string;
  format: string;
  processing_status: string;
  title: string;
  version_number: number;
};

const readable = (value: string) => value.replaceAll("_", " ");

export function DocumentLibrary({
  caseId,
  documents,
}: {
  caseId: string;
  documents: LibraryDocument[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("title");
  const filtered = useMemo(() => {
    const result = documents.filter(
      (document) =>
        (category === "all" || document.classification === category) &&
        document.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
    return [...result].sort((left, right) =>
      sort === "status"
        ? left.processing_status.localeCompare(right.processing_status)
        : left.title.localeCompare(right.title),
    );
  }, [category, documents, query, sort]);

  return (
    <div className="document-library">
      <div className="library-tools">
        <label className="library-search">
          <span className="sr-only">Search documents</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents…"
            type="search"
            value={query}
          />
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="all">All categories</option>
            <option value="legal">Legal</option>
            <option value="financial">Financial &amp; mortgage</option>
            <option value="personal_support">Personal support</option>
            <option value="shared">General coordination</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Sort documents</span>
          <select
            onChange={(event) => setSort(event.target.value)}
            value={sort}
          >
            <option value="title">Sort: Name</option>
            <option value="status">Sort: Status</option>
          </select>
        </label>
      </div>
      {filtered.length === 0 ? (
        <div className="library-empty">
          <h3>No matching documents</h3>
          <p>
            {documents.length === 0
              ? "Upload your first PDF or Word document to begin your private case library."
              : "Try another search or category."}
          </p>
        </div>
      ) : (
        <ol className="document-table">
          {filtered.map((document) => (
            <li key={document.document_id}>
              <span className={`file-icon file-${document.format}`}>
                {document.format.toUpperCase()}
              </span>
              <div className="document-name">
                <Link
                  href={`/cases/${caseId}/documents/${document.document_id}`}
                >
                  {document.title}
                </Link>
                <small>
                  {readable(document.classification)} ·{" "}
                  {(document.byte_size / 1024 / 1024).toFixed(2)} MB · version{" "}
                  {document.version_number}
                </small>
              </div>
              <span
                className={`document-status status-${document.processing_status}`}
              >
                {readable(document.processing_status)}
              </span>
              <Link
                className="row-action"
                href={`/cases/${caseId}/documents/${document.document_id}`}
              >
                Open <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
