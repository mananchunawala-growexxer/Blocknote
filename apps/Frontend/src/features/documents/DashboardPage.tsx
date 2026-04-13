import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createDocument, deleteDocument, getDocuments, renameDocument } from "../../lib/api";
import { sessionStore, useSession } from "../../stores/session";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const user = useSession((state) => state.user);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
  });

  const createMutation = useMutation({
    mutationFn: () => createDocument({ title: "Untitled" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: renameDocument,
    onSuccess: async () => {
      setEditingId(null);
      setDraftTitle("");
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  return (
    <main className="dashboard-layout">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Authenticated workspace</p>
          <h1>Your documents</h1>
          <p className="copy">{user?.email}</p>
        </div>
        <div className="dashboard-actions">
          <button onClick={() => createMutation.mutate()} type="button">
            New document
          </button>
          <button
            className="secondary"
            onClick={() => {
              sessionStore.clear();
            }}
            type="button"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="documents-panel">
        {documentsQuery.isLoading ? <p>Loading documents...</p> : null}
        {documentsQuery.error ? <p className="error-text">{documentsQuery.error.message}</p> : null}
        {documentsQuery.data?.items.length === 0 ? <p>No documents yet. Create your first one.</p> : null}
        <ul className="document-list">
          {documentsQuery.data?.items.map((document) => (
            <li key={document.id}>
              <div>
                {editingId === document.id ? (
                  <form
                    className="inline-title-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      renameMutation.mutate({ id: document.id, title: draftTitle });
                    }}
                  >
                    <input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      aria-label="Document title"
                    />
                    <button type="submit">Save</button>
                  </form>
                ) : (
                  <strong>{document.title}</strong>
                )}
                <p>Updated {formatDate(document.updatedAt)}</p>
              </div>
              <div className="document-row-actions">
                <span>{document.id.slice(0, 8)}</span>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditingId(document.id);
                    setDraftTitle(document.title);
                  }}
                  type="button"
                >
                  Rename
                </button>
                <button
                  className="danger"
                  onClick={() => deleteMutation.mutate(document.id)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
