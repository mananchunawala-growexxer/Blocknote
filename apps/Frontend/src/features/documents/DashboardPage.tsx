import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandLogo } from "../../components/BrandLogo";
import { createDocument, deleteDocument, getDocuments, renameDocument, updateDocumentShare } from "../../lib/api";
import { sessionStore, useSession } from "../../stores/session";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function syncDocumentOrder(storedOrder: string[], currentIds: string[]) {
  const storedSet = new Set(storedOrder);
  const validStored = storedOrder.filter((id) => currentIds.includes(id));
  const missingIds = currentIds.filter((id) => !storedSet.has(id));
  return [...validStored, ...missingIds];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSession((state) => state.user);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [shareFeedback, setShareFeedback] = useState<Record<string, string>>({});
  const [draggedDocumentId, setDraggedDocumentId] = useState<string | null>(null);
  const [dropTargetDocumentId, setDropTargetDocumentId] = useState<string | null>(null);
  const [isDocumentDeleteZoneHovered, setIsDocumentDeleteZoneHovered] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

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

  const shareMutation = useMutation({
    mutationFn: updateDocumentShare,
    onSuccess: async (response, variables) => {
      if (response.document.shareUrl) {
        const absoluteUrl = new URL(response.document.shareUrl, window.location.origin).toString();
        try {
          await navigator.clipboard.writeText(absoluteUrl);
        } catch {
          // Ignore clipboard failures and still refresh share state.
        }
        setShareFeedback((current) => ({
          ...current,
          [variables.id]: "Share link copied. Viewers can read, but not edit.",
        }));
      } else {
        setShareFeedback((current) => ({
          ...current,
          [variables.id]: "Sharing turned off.",
        }));
      }
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const allDocuments = documentsQuery.data?.items ?? [];
  const storageKey = `dashboard-document-order:${user?.id ?? user?.email ?? "guest"}`;

  useEffect(() => {
    const currentIds = allDocuments.map((document) => document.id);
    if (currentIds.length === 0) {
      setLocalOrder([]);
      return;
    }

    let nextOrder = currentIds;

    try {
      const storedOrderRaw = window.localStorage.getItem(storageKey);
      if (storedOrderRaw) {
        const parsedOrder = JSON.parse(storedOrderRaw) as string[];
        nextOrder = syncDocumentOrder(parsedOrder, currentIds);
      }
    } catch {
      nextOrder = currentIds;
    }

    setLocalOrder((current) => {
      const currentOrder = current ?? [];
      return JSON.stringify(currentOrder) === JSON.stringify(nextOrder) ? current : nextOrder;
    });
  }, [allDocuments, storageKey]);

  useEffect(() => {
    if (!localOrder) return;

    try {
      if (localOrder.length === 0) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      window.localStorage.setItem(storageKey, JSON.stringify(localOrder));
    } catch {
      // Ignore storage failures and keep the in-memory order.
    }
  }, [localOrder, storageKey]);

  const orderedDocuments = localOrder
    ? localOrder
      .map((id) => allDocuments.find((doc) => doc.id === id))
      .filter(Boolean) as typeof allDocuments
    : allDocuments;

  const filteredDocuments = orderedDocuments.filter((document) =>
    document.title.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const moveDocument = useCallback((movingId: string, targetId: string) => {
    setLocalOrder((current) => {
      const baseOrder = syncDocumentOrder(current ?? allDocuments.map((document) => document.id), allDocuments.map((document) => document.id));
      const fromIndex = baseOrder.indexOf(movingId);
      const targetIndex = baseOrder.indexOf(targetId);

      if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
        return baseOrder;
      }

      const nextOrder = [...baseOrder];
      const [movedId] = nextOrder.splice(fromIndex, 1);
      nextOrder.splice(targetIndex, 0, movedId);
      return nextOrder;
    });
  }, [allDocuments]);

  const handleDragStart = useCallback(
    (documentId: string, event: React.DragEvent<HTMLLIElement>) => {
      setDraggedDocumentId(documentId);
      setDropTargetDocumentId(documentId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", documentId);
    },
    [],
  );

  const handleDragOver = useCallback(
    (targetDocumentId: string, event: React.DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (!draggedDocumentId || draggedDocumentId === targetDocumentId) return;
      moveDocument(draggedDocumentId, targetDocumentId);
      setDropTargetDocumentId(targetDocumentId);
    },
    [draggedDocumentId, moveDocument],
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetDocumentId(null);
  }, []);

  const handleDrop = useCallback(
    (targetDocumentId: string, event: React.DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const droppedDocumentId = event.dataTransfer.getData("text/plain") || draggedDocumentId;
      if (droppedDocumentId && droppedDocumentId !== targetDocumentId) {
        moveDocument(droppedDocumentId, targetDocumentId);
      }
      setDraggedDocumentId(null);
      setDropTargetDocumentId(null);
      setIsDocumentDeleteZoneHovered(false);
    },
    [draggedDocumentId, moveDocument],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedDocumentId(null);
    setDropTargetDocumentId(null);
    setIsDocumentDeleteZoneHovered(false);
  }, []);

  const handleDeleteZoneDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const droppedDocumentId = event.dataTransfer.getData("text/plain") || draggedDocumentId;

      if (droppedDocumentId) {
        await deleteMutation.mutateAsync(droppedDocumentId);
      }

      setDraggedDocumentId(null);
      setDropTargetDocumentId(null);
      setIsDocumentDeleteZoneHovered(false);
    },
    [deleteMutation, draggedDocumentId],
  );

  return (
    <main className="workspace-layout">
      <aside className="workspace-sidebar">
        <BrandLogo compact />
        <div className="workspace-user">
          <p className="eyebrow">Signed in</p>
          <p className="copy">{user?.email}</p>
        </div>
        <div className="workspace-actions">
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
        <div className="workspace-search">
          <label className="workspace-search-label" htmlFor="document-search">
            Search documents
          </label>
          <input
            id="document-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by title..."
          />
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-main-header">
          <div>
            <p className="eyebrow">Documents</p>
            <h1>Your writing workspace</h1>
            <p className="copy">Organize notes, drafts, and project docs in one place.</p>
          </div>
        </header>

        <section className={`documents-panel ${draggedDocumentId ? "is-document-dragging" : ""}`}>
          {documentsQuery.isLoading ? <p>Loading documents...</p> : null}
          {documentsQuery.error ? <p className="error-text">{documentsQuery.error.message}</p> : null}
          {documentsQuery.data?.items.length === 0 ? <p>No documents yet. Create your first one.</p> : null}
          {documentsQuery.data?.items.length && filteredDocuments.length === 0 ? (
            <p>No documents match your search.</p>
          ) : null}
          <ul className="document-list">
            {filteredDocuments.map((document) => (
              <li
                key={document.id}
                draggable
                onDragStart={(e) => handleDragStart(document.id, e)}
                onDragOver={(e) => handleDragOver(document.id, e)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(document.id, e)}
                onDragEnd={handleDragEnd}
                className={[
                  dropTargetDocumentId === document.id ? "doc-drop-target" : "",
                  draggedDocumentId === document.id ? "doc-dragging" : "",
                ].join(" ")}
              >
                <div className="doc-drag-handle" title="Drag to reorder">
                  ⋮⋮
                </div>
                <div className="doc-item-content">
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
                    <div>
                      <strong
                        className="document-title"
                        onClick={() => navigate(`/documents/${document.id}`)}
                        title="Click to open document"
                      >
                        {document.title}
                      </strong>
                      <p>Updated {formatDate(document.updatedAt)}</p>
                      {shareFeedback[document.id] ? <p className="share-feedback">{shareFeedback[document.id]}</p> : null}
                    </div>
                  )}
                </div>
                <div className="document-row-actions">
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
                    className="secondary"
                    onClick={() => navigate(`/documents/${document.id}`)}
                    type="button"
                  >
                    Open
                  </button>
                  {document.shareUrl ? (
                    <button
                      className="secondary"
                      onClick={() => {
                        void navigator.clipboard.writeText(new URL(document.shareUrl!, window.location.origin).toString());
                      }}
                      type="button"
                    >
                      Copy link
                    </button>
                  ) : null}
                  <button
                    className="secondary"
                    onClick={() => shareMutation.mutate({ id: document.id, isPublic: !document.isPublic })}
                    type="button"
                  >
                    {document.isPublic ? "Disable share" : "Share"}
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (window.confirm(`Delete "${document.title}"? This action cannot be undone.`)) {
                        deleteMutation.mutate(document.id);
                      }
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div
            className={`document-delete-zone ${draggedDocumentId ? "active" : ""} ${isDocumentDeleteZoneHovered ? "hovered" : ""}`}
            onDragOver={(event) => {
              if (!draggedDocumentId) return;
              event.preventDefault();
              setIsDocumentDeleteZoneHovered(true);
            }}
            onDragEnter={(event) => {
              if (!draggedDocumentId) return;
              event.preventDefault();
              setIsDocumentDeleteZoneHovered(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setIsDocumentDeleteZoneHovered(false);
            }}
            onDrop={(event) => {
              void handleDeleteZoneDrop(event);
            }}
          >
            <span className="document-delete-zone-icon" aria-hidden="true">
              🗑
            </span>
            <span className="document-delete-zone-copy">
              <span className="document-delete-zone-title">Drop document to delete</span>
              <span className="document-delete-zone-hint">Release here to remove it permanently</span>
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}
