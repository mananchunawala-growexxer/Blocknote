import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WorkspaceHeader } from "../../components/WorkspaceHeader";
import { getDocumentDetail, getDocuments, getSharedDocumentDetail, renameDocument, updateDocumentShare } from "../../lib/api";
import { BlockEditor } from "../../components/BlockEditor";
import { useSession } from "../../stores/session";
import type { BlockDto } from "../../types/block";

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
  const [shareErrorMessage, setShareErrorMessage] = useState<string | null>(null);
  const [pdfErrorMessage, setPdfErrorMessage] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

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
      setShareErrorMessage(null);
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
    onError: (error: Error) => {
      setShareErrorMessage(error.message || "Unable to update share settings right now.");
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
  const blocks = documentDetailQuery.data?.blocks ?? [];

  const buildPdfFilename = (title: string) => {
    const cleaned = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return `${cleaned || "document"}.pdf`;
  };

  const getBlockText = (block: BlockDto): string => {
    if (block.type === "image") {
      return String(block.content.url ?? "").trim();
    }
    return String(block.content.text ?? "").trim();
  };

  const handleDownloadPdf = async () => {
    if (!document) return;

    setPdfErrorMessage(null);
    setIsDownloadingPdf(true);

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
      const marginX = 48;
      const topMargin = 54;
      const bottomMargin = 54;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - marginX * 2;
      let cursorY = topMargin;

      const ensureSpace = (requiredHeight: number) => {
        if (cursorY + requiredHeight <= pageHeight - bottomMargin) return;
        pdf.addPage();
        cursorY = topMargin;
      };

      const drawWrappedText = (
        text: string,
        options: { size?: number; bold?: boolean; lineHeight?: number; color?: [number, number, number] } = {},
      ) => {
        const size = options.size ?? 12;
        const lineHeight = options.lineHeight ?? size + 4;
        const color = options.color ?? [24, 35, 52];
        const safeText = text.length > 0 ? text : " ";
        pdf.setFont("helvetica", options.bold ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(safeText, contentWidth) as string[];
        ensureSpace(lines.length * lineHeight + 4);
        pdf.text(lines, marginX, cursorY);
        cursorY += lines.length * lineHeight;
      };

      drawWrappedText(document.title, { size: 24, bold: true, lineHeight: 30 });
      cursorY += 6;
      drawWrappedText(`Exported ${new Date().toLocaleString()}`, {
        size: 10,
        color: [90, 108, 131],
        lineHeight: 14,
      });
      cursorY += 14;

      for (const block of blocks) {
        const text = getBlockText(block);

        if (block.type === "divider") {
          ensureSpace(16);
          pdf.setDrawColor(190, 205, 230);
          pdf.setLineWidth(1);
          pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
          cursorY += 16;
          continue;
        }

        if (block.type === "heading_1") {
          drawWrappedText(text, { size: 19, bold: true, lineHeight: 25 });
          cursorY += 8;
          continue;
        }

        if (block.type === "heading_2") {
          drawWrappedText(text, { size: 16, bold: true, lineHeight: 22 });
          cursorY += 7;
          continue;
        }

        if (block.type === "todo") {
          const checked = Boolean(block.content.checked);
          drawWrappedText(`${checked ? "[x]" : "[ ]"} ${text}`, { size: 12, lineHeight: 17 });
          cursorY += 6;
          continue;
        }

        if (block.type === "code") {
          const codeText = text || " ";
          pdf.setFont("courier", "normal");
          pdf.setFontSize(11);
          const codeLines = pdf.splitTextToSize(codeText, contentWidth - 16) as string[];
          const lineHeight = 15;
          const blockHeight = codeLines.length * lineHeight + 14;
          ensureSpace(blockHeight + 8);
          pdf.setFillColor(242, 246, 252);
          pdf.roundedRect(marginX, cursorY - 10, contentWidth, blockHeight, 6, 6, "F");
          pdf.setTextColor(26, 39, 62);
          pdf.text(codeLines, marginX + 8, cursorY + 4);
          cursorY += blockHeight + 10;
          pdf.setFont("helvetica", "normal");
          continue;
        }

        if (block.type === "image") {
          const imageUrl = text;
          drawWrappedText(imageUrl ? `Image: ${imageUrl}` : "Image block", {
            size: 11,
            color: [90, 108, 131],
            lineHeight: 16,
          });
          cursorY += 6;
          continue;
        }

        drawWrappedText(text, { size: 12, lineHeight: 18 });
        cursorY += 8;
      }

      const filename = buildPdfFilename(document.title);
      pdf.save(filename);

      try {
        window.localStorage.setItem(
          `pdf-export:${document.id}`,
          JSON.stringify({ filename, exportedAt: new Date().toISOString() }),
        );
      } catch {
        // Ignore localStorage failures without blocking download.
      }
    } catch (error) {
      console.error(error);
      setPdfErrorMessage("Unable to generate PDF right now. Please try again.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

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
        <WorkspaceHeader
          eyebrow={isOwner ? "Editing" : "Shared document"}
          title={
            isOwner && isEditingTitle ? (
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
            )
          }
          subtitle={isOwner ? "Shape your notes, share with readers, and export polished drafts." : "Shared access is view only, so the original document stays protected."}
          actions={
            <>
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
                    onClick={() => {
                      void handleDownloadPdf();
                    }}
                    disabled={isDownloadingPdf}
                  >
                    {isDownloadingPdf ? "Preparing PDF..." : "Download PDF"}
                  </button>
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
            </>
          }
        />

        <div className="editor-content">
          {shareUrl && isOwner ? <p className="share-banner">Anyone with the share link can read this document, but cannot edit it.</p> : null}
          {shareErrorMessage ? <p className="error-text share-error-text">{shareErrorMessage}</p> : null}
          {pdfErrorMessage ? <p className="error-text share-error-text">{pdfErrorMessage}</p> : null}
          <BlockEditor
            documentId={document.id}
            initialBlocks={blocks}
            initialSavedAt={document.updatedAt}
            readOnly={!isOwner}
            queryKey={isSharedView ? ["shared-document", shareToken!, "blocks"] : ["documents", document.id, "blocks"]}
          />
        </div>
      </section>
    </main>
  );
};
