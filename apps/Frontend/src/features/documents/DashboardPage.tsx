import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "../../components/WorkspaceHeader";
import { createDocument, deleteDocument, getDocuments, renameDocument, updateDocumentShare } from "../../lib/api";
import { sessionStore, useSession } from "../../stores/session";

const DOCUMENT_DRAG_MIME = "application/x-blocknote-document-id";

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
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [shareErrors, setShareErrors] = useState<Record<string, string>>({});
  const [shareToast, setShareToast] = useState<{ message: string; link: string | null } | null>(null);
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
      setShareErrors((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      if (response.document.shareUrl) {
        const absoluteUrl = new URL(response.document.shareUrl, window.location.origin).toString();
        try {
          await navigator.clipboard.writeText(absoluteUrl);
        } catch {
          // Ignore clipboard failures and still refresh share state.
        }
        setShareLinks((current) => ({
          ...current,
          [variables.id]: absoluteUrl,
        }));
        setShareFeedback((current) => ({
          ...current,
          [variables.id]: "Share link is active and copied.",
        }));
        setShareToast({
          message: "Share link is ready",
          link: absoluteUrl,
        });
      } else {
        setShareLinks((current) => {
          const next = { ...current };
          delete next[variables.id];
          return next;
        });
        setShareFeedback((current) => ({
          ...current,
          [variables.id]: "Sharing turned off.",
        }));
        setShareToast({
          message: "Sharing turned off",
          link: null,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (error: Error, variables) => {
      setShareErrors((current) => ({
        ...current,
        [variables.id]: error.message || "Unable to update share settings right now.",
      }));
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

  const getDraggedDocumentIdFromEvent = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragIdFromCustomType = event.dataTransfer.getData(DOCUMENT_DRAG_MIME);
    const dragIdFromPlainText = event.dataTransfer.getData("text/plain");
    return dragIdFromCustomType || dragIdFromPlainText || draggedDocumentId;
  }, [draggedDocumentId]);

  const handleDragStart = useCallback(
    (documentId: string, event: React.DragEvent<HTMLLIElement>) => {
      setDraggedDocumentId(documentId);
      setDropTargetDocumentId(documentId);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DOCUMENT_DRAG_MIME, documentId);
      event.dataTransfer.setData("text/plain", documentId);

      const row = event.currentTarget;
      const preview = row.cloneNode(true) as HTMLElement;
      preview.classList.add("doc-drag-preview");
      preview.style.width = `${row.getBoundingClientRect().width}px`;
      preview.style.left = "-9999px";
      preview.style.top = "-9999px";
      document.body.appendChild(preview);
      event.dataTransfer.setDragImage(preview, Math.min(36, row.clientWidth / 2), 20);
      requestAnimationFrame(() => {
        preview.remove();
      });
    },
    [],
  );

  const handleDragOver = useCallback(
    (targetDocumentId: string, event: React.DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const movingDocumentId = getDraggedDocumentIdFromEvent(event);
      if (!movingDocumentId || movingDocumentId === targetDocumentId) return;
      if (draggedDocumentId !== movingDocumentId) {
        setDraggedDocumentId(movingDocumentId);
      }
      moveDocument(movingDocumentId, targetDocumentId);
      setDropTargetDocumentId(targetDocumentId);
    },
    [draggedDocumentId, getDraggedDocumentIdFromEvent, moveDocument],
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetDocumentId(null);
  }, []);

  const handleDrop = useCallback(
    (targetDocumentId: string, event: React.DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const droppedDocumentId = getDraggedDocumentIdFromEvent(event);
      if (droppedDocumentId && droppedDocumentId !== targetDocumentId) {
        moveDocument(droppedDocumentId, targetDocumentId);
      }
      setDraggedDocumentId(null);
      setDropTargetDocumentId(null);
      setIsDocumentDeleteZoneHovered(false);
    },
    [getDraggedDocumentIdFromEvent, moveDocument],
  );

  const handleDragEnd = useCallback(() => {
    setDraggedDocumentId(null);
    setDropTargetDocumentId(null);
    setIsDocumentDeleteZoneHovered(false);
  }, []);

  const handleDeleteZoneDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const droppedDocumentId = getDraggedDocumentIdFromEvent(event);

      if (droppedDocumentId) {
        await deleteMutation.mutateAsync(droppedDocumentId);
        setLocalOrder((current) => (current ? current.filter((id) => id !== droppedDocumentId) : current));
      }

      setDraggedDocumentId(null);
      setDropTargetDocumentId(null);
      setIsDocumentDeleteZoneHovered(false);
    },
    [deleteMutation, getDraggedDocumentIdFromEvent],
  );

  useEffect(() => {
    if (!shareToast) return;
    const timeoutId = window.setTimeout(() => {
      setShareToast(null);
    }, 5600);
    return () => window.clearTimeout(timeoutId);
  }, [shareToast]);

  return (
    <main className="workspace-layout">
      <aside className="workspace-sidebar">
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
        {shareToast ? (
          <div className="share-top-toast" role="status" aria-live="polite">
            <div className="share-top-toast-content">
              <span className="share-top-toast-text">{shareToast.message}</span>
              {shareToast.link ? (
                <span className="share-top-toast-link" title={shareToast.link}>
                  {shareToast.link}
                </span>
              ) : null}
            </div>
            {shareToast.link ? (
              <button
                type="button"
                className="share-top-toast-copy"
                onClick={() => {
                  void navigator.clipboard.writeText(shareToast.link!);
                  setShareToast({ message: "Link copied", link: shareToast.link });
                }}
              >
                Copy link
              </button>
            ) : null}
            <button type="button" className="share-top-toast-close" onClick={() => setShareToast(null)} aria-label="Close toast">
              ✕
            </button>
          </div>
        ) : null}

        <WorkspaceHeader
          eyebrow="Documents"
          title={<h1>Your writing workspace</h1>}
          subtitle="Organize notes, drafts, and project docs in one place."
        />

        <section className={`documents-panel ${draggedDocumentId ? "is-document-dragging" : ""}`}>
          {documentsQuery.isLoading ? <p>Loading documents...</p> : null}
          {documentsQuery.error ? <p className="error-text">{documentsQuery.error.message}</p> : null}
          {documentsQuery.data?.items.length === 0 ? <p>No documents yet. Create your first one.</p> : null}
          {documentsQuery.data?.items.length && filteredDocuments.length === 0 ? (
            <p>No documents match your search.</p>
          ) : null}
          <ul className="document-list">
            {filteredDocuments.map((document) => {
              const visibleShareUrl = shareLinks[document.id]
                ?? (document.shareUrl ? new URL(document.shareUrl, window.location.origin).toString() : null);

              return (
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
                        {shareErrors[document.id] ? <p className="error-text share-error-text">{shareErrors[document.id]}</p> : null}
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
              );
            })}
          </ul>

          <div
            className={`document-delete-zone ${draggedDocumentId ? "active" : ""} ${isDocumentDeleteZoneHovered ? "hovered" : ""}`}
            onDragOver={(event) => {
              const droppedDocumentId = getDraggedDocumentIdFromEvent(event);
              if (!droppedDocumentId) return;
              event.preventDefault();
              if (draggedDocumentId !== droppedDocumentId) {
                setDraggedDocumentId(droppedDocumentId);
              }
              setIsDocumentDeleteZoneHovered(true);
            }}
            onDragEnter={(event) => {
              const droppedDocumentId = getDraggedDocumentIdFromEvent(event);
              if (!droppedDocumentId) return;
              event.preventDefault();
              if (draggedDocumentId !== droppedDocumentId) {
                setDraggedDocumentId(droppedDocumentId);
              }
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
