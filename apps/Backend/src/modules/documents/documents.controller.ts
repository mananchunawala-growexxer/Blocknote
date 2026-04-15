import type { Request, Response } from "express";
import {
  createDocumentWithInitialBlock,
  deleteDocumentForUser,
  getSharedDocumentDetail,
  getDocumentDetailForUser,
  listDocuments,
  renameDocumentForUser,
  updateDocumentShareForUser,
} from "./documents.service.js";

function getRouteId(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value ?? "";
}

export async function listDocumentsController(req: Request, res: Response): Promise<void> {
  const response = await listDocuments(req.auth!.id);
  res.status(200).json(response);
}

export async function getSharedDocumentController(req: Request, res: Response): Promise<void> {
  const response = await getSharedDocumentDetail(getRouteId(req.params.shareToken));
  res.status(200).json(response);
}

export async function createDocumentController(req: Request, res: Response): Promise<void> {
  const document = await createDocumentWithInitialBlock(req.auth!.id, req.body?.title);
  res.status(201).json({ document });
}

export async function getDocumentController(req: Request, res: Response): Promise<void> {
  const response = await getDocumentDetailForUser(req.auth!.id, getRouteId(req.params.id));
  res.status(200).json(response);
}

export async function renameDocumentController(req: Request, res: Response): Promise<void> {
  const document = await renameDocumentForUser(req.auth!.id, getRouteId(req.params.id), req.body?.title);
  res.status(200).json({ document });
}

export async function deleteDocumentController(req: Request, res: Response): Promise<void> {
  await deleteDocumentForUser(req.auth!.id, getRouteId(req.params.id));
  res.status(204).send();
}

export async function updateDocumentShareController(req: Request, res: Response): Promise<void> {
  const response = await updateDocumentShareForUser(req.auth!.id, getRouteId(req.params.id), {
    isPublic: Boolean(req.body?.isPublic),
  });
  res.status(200).json(response);
}
