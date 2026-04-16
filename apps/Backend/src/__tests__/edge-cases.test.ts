import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { app } from "../app.js";
import { pool } from "../lib/db.js";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  token?: string;
  body?: Record<string, unknown>;
};

type JsonRecord = Record<string, any>;

let server: Server | null = null;
let baseUrl = "";

before(async () => {
  server = await new Promise<Server>((resolve, reject) => {
    const nextServer = app.listen(0);
    nextServer.once("listening", () => resolve(nextServer));
    nextServer.once("error", reject);
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error("Test server did not expose an address");
  }

  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (!server || !server.listening) {
    await pool.end();
    return;
  }

  const activeServer = server;
  await new Promise<void>((resolve, reject) => {
    activeServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  await pool.end();
});

async function apiRequest(path: string, options: RequestOptions = {}) {
  const headers: Record<string, string> = {};
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json: JsonRecord | null = null;
  if (text.length > 0) {
    try {
      json = JSON.parse(text) as JsonRecord;
    } catch {
      json = null;
    }
  }

  return { response, text, json };
}

async function registerUser(label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@example.com`;
  const password = "Password123";

  const { response, json } = await apiRequest("/auth/register", {
    method: "POST",
    body: { email, password },
  });

  assert.equal(response.status, 201);
  assert.ok(json?.accessToken);
  assert.ok(json?.refreshToken);
  assert.equal(json?.user?.email, email);

  return {
    email,
    password,
    accessToken: String(json!.accessToken),
    refreshToken: String(json!.refreshToken),
    userId: String(json!.user.id),
  };
}

test("shared token route rejects write methods at API level", async () => {
  for (const method of ["POST", "PATCH", "DELETE"] as const) {
    const { response, json } = await apiRequest("/documents/shared/demo-token", { method });
    assert.equal(response.status, 405);
    assert.equal(json?.message, "Shared document routes are read-only. Use GET for share tokens.");
  }
});

test("cross-account document and block access returns 403", async () => {
  const owner = await registerUser("owner");
  const intruder = await registerUser("intruder");

  const createDocumentResult = await apiRequest("/documents", {
    method: "POST",
    token: owner.accessToken,
    body: { title: "Ownership test doc" },
  });

  assert.equal(createDocumentResult.response.status, 201);
  const documentId = String(createDocumentResult.json?.document?.id);
  assert.ok(documentId);

  const ownerDocumentDetail = await apiRequest(`/documents/${documentId}`, {
    method: "GET",
    token: owner.accessToken,
  });

  assert.equal(ownerDocumentDetail.response.status, 200);
  const blocks = ownerDocumentDetail.json?.blocks;
  assert.ok(Array.isArray(blocks));
  assert.ok(blocks.length > 0);
  const firstBlockId = String(blocks[0].id);

  const forbiddenDocumentRead = await apiRequest(`/documents/${documentId}`, {
    method: "GET",
    token: intruder.accessToken,
  });
  assert.equal(forbiddenDocumentRead.response.status, 403);

  const forbiddenBlockList = await apiRequest(`/blocks/documents/${documentId}/blocks`, {
    method: "GET",
    token: intruder.accessToken,
  });
  assert.equal(forbiddenBlockList.response.status, 403);

  const forbiddenBlockPatch = await apiRequest(`/blocks/${firstBlockId}`, {
    method: "PATCH",
    token: intruder.accessToken,
    body: {
      content: {
        text: "not allowed",
        html: "not allowed",
      },
    },
  });
  assert.equal(forbiddenBlockPatch.response.status, 403);

  const forbiddenBlockDelete = await apiRequest(`/blocks/${firstBlockId}`, {
    method: "DELETE",
    token: intruder.accessToken,
  });
  assert.equal(forbiddenBlockDelete.response.status, 403);
});

test("shared links allow read-only document access", async () => {
  const owner = await registerUser("shared-owner");

  const createDocumentResult = await apiRequest("/documents", {
    method: "POST",
    token: owner.accessToken,
    body: { title: "Shared read only doc" },
  });

  assert.equal(createDocumentResult.response.status, 201);
  const documentId = String(createDocumentResult.json?.document?.id);
  assert.ok(documentId);

  const shareResult = await apiRequest(`/documents/${documentId}/share`, {
    method: "PATCH",
    token: owner.accessToken,
    body: { isPublic: true },
  });

  assert.equal(shareResult.response.status, 200);
  const shareToken = String(shareResult.json?.document?.shareToken ?? "");
  assert.ok(shareToken);

  const sharedRead = await apiRequest(`/documents/shared/${shareToken}`, {
    method: "GET",
  });

  assert.equal(sharedRead.response.status, 200);
  assert.equal(sharedRead.json?.document?.viewerRole, "shared_reader");
  assert.equal(sharedRead.json?.document?.isPublic, true);
  assert.ok(Array.isArray(sharedRead.json?.blocks));
});
