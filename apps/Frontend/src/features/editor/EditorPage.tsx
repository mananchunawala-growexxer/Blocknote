import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandLogo } from "../../components/BrandLogo";
import { getDocumentDetail, getDocuments, getSharedDocumentDetail, renameDocument, updateDocumentShare } from "../../lib/api";
import { BlockEditor } from "../../components/BlockEditor";
import { useSession } from "../../stores/session";

/**
 * EditorPage displays a document with its block editor
 */
export const EditorPage: React.FC = () => {
  const { documentId, shareToken } = useParams<{ documentId?: string; shareToken?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const accessToken = useSession((state) => state.accessToken);
  const isSharedView = Boolean(shareToken);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
    enabled: Boolean(accessToken) && !isSharedView,
  });

  const documentDetailQuery = useQuery({
    queryKey: isSharedView ? ["shared-document", shareToken] : ["document", documentId],
    queryFn: () => (isSharedView && shareToken ? getSharedDocumentDetail(shareToken) : getDocumentDetail(documentId!)),
    enabled: Boolean(shareToken || documentId),
  });

  const shareMutation = useMutation({
    mutationFn: updateDocumentShare,
    onSuccess: async (response) => {
      if (response.document.shareUrl) {
        try {
          await navigator.clipboard.writeText(new URL(response.document.shareUrl, window.location.origin).toString());
        } catch {
          // Ignore clipboard failures and still refresh share state.
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
      ]);
    },
  });

  const renameMutation = useMutation({
    mutationFn: renameDocument,
    onSuccess: async () => {
      setIsEditingTitle(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["documents"] }),
        queryClient.invalidateQueries({ queryKey: ["document", documentId] }),
      ]);
    },
  });

  const document = documentDetailQuery.data?.document;

  useEffect(() => {
    setTitleDraft(document?.title ?? "");
  }, [document?.title]);

  if (!documentId && !shareToken) {
    return <div>Document ID not found</div>;
  }

  if (documentDetailQuery.isLoading) {
    return <div>Loading document...</div>;
  }

  if (documentDetailQuery.error) {
    return <div>Error loading document</div>;
  }

  if (!document) {
    return <div>Document not found</div>;
  }

  // Some deployments can briefly return detail payloads without viewerRole after re-auth.
  // Treat authenticated non-shared document routes as owner mode by default.
  const isOwner = isSharedView ? false : Boolean(accessToken) && document.viewerRole !== "shared_reader";
  const shareUrl = document.shareUrl ? new URL(document.shareUrl, window.location.origin).toString() : null;

  return (
    <main className="workspace-layout editor-shell">
      <aside className="workspace-sidebar">
        <BrandLogo compact />
        <button className="secondary back-button" onClick={() => navigate("/")}>
          ← {isOwner ? "Documents" : "Home"}
        </button>
        {isOwner ? (
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
        ) : (
          <div className="workspace-user">
            <p className="eyebrow">Shared access</p>
            <p className="copy">You can read this document, but editing is disabled.</p>
          </div>
        )}
      </aside>

      <section className="workspace-main editor-layout">
        <header className="editor-header">
          <div>
            <p className="eyebrow">{isOwner ? "Editing" : "Shared document"}</p>
            {isOwner && isEditingTitle ? (
              <form
                className="editor-title-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  renameMutation.mutate({ id: document.id, title: titleDraft });
                }}
              >
                <input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  aria-label="Document title"
                  autoFocus
                />
                <button type="submit" className="secondary share-toggle-btn">Save</button>
                <button type="button" className="secondary share-toggle-btn" onClick={() => {
                  setIsEditingTitle(false);
                  setTitleDraft(document.title);
                }}>
                  Cancel
                </button>
              </form>
            ) : (
              <h1
                className={isOwner ? "editable-editor-title" : ""}
                onClick={() => {
                  if (isOwner) {
                    setIsEditingTitle(true);
                  }
                }}
                title={isOwner ? "Click to rename" : undefined}
              >
                {document.title}
              </h1>
            )}
          </div>
          <div className="editor-header-actions">
            <button
              type="button"
              className="secondary share-toggle-btn editor-nav-button"
              onClick={() => navigate(isOwner ? "/" : "/auth")}
            >
              {isOwner ? "Dashboard" : "Login / Register"}
            </button>
            {isOwner ? (
              <>
                <button
                  type="button"
                  className="secondary share-toggle-btn"
                  onClick={() => shareMutation.mutate({ id: document.id, isPublic: !document.isPublic })}
                >
                  {document.isPublic ? "Disable share" : "Enable share"}
                </button>
                {shareUrl ? (
                  <button
                    type="button"
                    className="secondary share-toggle-btn"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl);
                    }}
                  >
                    Copy share link
                  </button>
                ) : null}
              </>
            ) : (
              <span className="editor-header-spacer">Read only</span>
            )}
          </div>
        </header>

        <div className="editor-content">
          {shareUrl && isOwner ? <p className="share-banner">Anyone with the share link can read this document, but cannot edit it.</p> : null}
          <BlockEditor
            documentId={document.id}
            initialBlocks={documentDetailQuery.data?.blocks ?? []}
            initialSavedAt={document.updatedAt}
            readOnly={!isOwner}
            queryKey={isSharedView ? ["shared-document", shareToken!, "blocks"] : ["documents", document.id, "blocks"]}
          />
        </div>
      </section>
    </main>
  );
};
