import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDocuments } from "../../lib/api";
import { BlockEditor } from "../../components/BlockEditor";

/**
 * EditorPage displays a document with its block editor
 */
export const EditorPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
  });

  if (!documentId) {
    return <div>Document ID not found</div>;
  }

  if (documentsQuery.isLoading) {
    return <div>Loading documents...</div>;
  }

  if (documentsQuery.error) {
    return <div>Error loading documents</div>;
  }

  const document = documentsQuery.data?.items.find((d) => d.id === documentId);

  if (!document) {
    return <div>Document not found</div>;
  }

  return (
    <main className="workspace-layout editor-shell">
      <aside className="workspace-sidebar">
        <div className="brand">BlockNote</div>
        <button className="secondary back-button" onClick={() => navigate("/")}>
          ← Documents
        </button>
        <div className="workspace-doc-list">
          <p className="eyebrow">All docs</p>
          <ul>
            {documentsQuery.data?.items.slice(0, 10).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`sidebar-doc-item ${item.id === documentId ? "active" : ""}`}
                  onClick={() => navigate(`/documents/${item.id}`)}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="workspace-main editor-layout">
        <header className="editor-header">
          <div>
            <p className="eyebrow">Editing</p>
            <h1>{document.title}</h1>
          </div>
          <div className="editor-header-spacer">/{document.id.slice(0, 8)}</div>
        </header>

        <div className="editor-content">
          <BlockEditor documentId={documentId} />
        </div>
      </section>
    </main>
  );
};
