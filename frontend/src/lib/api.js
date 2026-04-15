import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from './declarations.js';
import { get } from 'svelte/store';
import { identity } from './auth.js';

const CANISTER_ID = import.meta.env.VITE_CANISTER_ID ?? '';
const IS_LOCAL = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const HOST = IS_LOCAL ? 'http://localhost:4943' : 'https://ic0.app';

function _makeActor(id = null) {
  const agent = new HttpAgent({ identity: id ?? undefined, host: HOST });
  if (IS_LOCAL) agent.fetchRootKey().catch(() => {});
  return Actor.createActor(idlFactory, { agent, canisterId: CANISTER_ID });
}

function _actor(authenticated = false) {
  if (authenticated) {
    const id = get(identity);
    if (!id) throw new Error('Not authenticated');
    return _makeActor(id);
  }
  return _makeActor();
}

function _parse(raw) {
  const result = JSON.parse(raw);
  if (result?.error) throw new Error(result.error);
  return result;
}

// ---------------------------------------------------------------------------
// Public queries
// ---------------------------------------------------------------------------

export async function listNamespaces() {
  const raw = await _actor().list_namespaces();
  return JSON.parse(raw);
}

export async function listFiles(namespace) {
  const raw = await _actor().list_files(JSON.stringify({ namespace }));
  return JSON.parse(raw);
}

export async function getStats() {
  const raw = await _actor().get_stats();
  return JSON.parse(raw);
}

export async function getAcl() {
  const raw = await _actor().get_acl();
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Authenticated updates
// ---------------------------------------------------------------------------

export async function storeFile(namespace, path, fileBytes, contentType) {
  const content_b64 = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));
  const raw = await _actor(true).store_file(
    JSON.stringify({ namespace, path, content_b64, content_type: contentType })
  );
  return _parse(raw);
}

export async function storeFileChunked(namespace, path, fileBytes, contentType, onProgress) {
  const CHUNK = 500_000; // 500 KB
  const total = Math.ceil(fileBytes.byteLength / CHUNK);
  for (let i = 0; i < total; i++) {
    const slice = fileBytes.slice(i * CHUNK, (i + 1) * CHUNK);
    const data_b64 = btoa(String.fromCharCode(...new Uint8Array(slice)));
    const raw = await _actor(true).store_file_chunk(
      JSON.stringify({
        namespace,
        path,
        chunk_index: i,
        total_chunks: total,
        data_b64,
        content_type: contentType,
      })
    );
    _parse(raw);
    onProgress?.(i + 1, total);
  }
  const raw = await _actor(true).finalize_chunked_file(
    JSON.stringify({ namespace, path })
  );
  return _parse(raw);
}

export async function uploadFile(namespace, path, fileBytes, contentType, onProgress) {
  if (fileBytes.byteLength > 500_000) {
    return storeFileChunked(namespace, path, fileBytes, contentType, onProgress);
  }
  return storeFile(namespace, path, fileBytes, contentType);
}

export async function deleteFile(namespace, path) {
  const raw = await _actor(true).delete_file(JSON.stringify({ namespace, path }));
  return _parse(raw);
}

export async function grantPublish(namespace, principalStr) {
  const raw = await _actor(true).grant_publish(
    JSON.stringify({ namespace, principal: principalStr })
  );
  return _parse(raw);
}

export async function revokePublish(namespace, principalStr) {
  const raw = await _actor(true).revoke_publish(
    JSON.stringify({ namespace, principal: principalStr })
  );
  return _parse(raw);
}

export async function deleteNamespace(namespace) {
  const raw = await _actor(true).delete_namespace(JSON.stringify({ namespace }));
  return _parse(raw);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fileUrl(namespace, path) {
  if (!CANISTER_ID) return '#';
  const host = IS_LOCAL ? `http://localhost:4943` : `https://${CANISTER_ID}.icp0.io`;
  return `${host}/${namespace}/${path}`;
}

export function guessContentType(filename) {
  const map = {
    '.py':   'text/plain',
    '.js':   'application/javascript',
    '.mjs':  'application/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css':  'text/css',
    '.wasm': 'application/wasm',
    '.txt':  'text/plain',
    '.md':   'text/markdown',
    '.svg':  'image/svg+xml',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ts':   'text/plain',
    '.toml': 'text/plain',
    '.yaml': 'text/plain',
    '.yml':  'text/plain',
  };
  for (const [ext, ct] of Object.entries(map)) {
    if (filename.endsWith(ext)) return ct;
  }
  return 'application/octet-stream';
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
