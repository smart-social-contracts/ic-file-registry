import { HttpAgent, Actor } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { IDL } from '@dfinity/candid';

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────
const CANISTER_ID = 'od2mb-wyaaa-aaaac-qgmza-cai';
const IC_HOST     = 'https://icp0.io';
const II_URL      = 'https://identity.ic0.app';
const CHUNK_SIZE  = 400_000;

// ────────────────────────────────────────────────────────────────────────────
// IDL
// ────────────────────────────────────────────────────────────────────────────
const idlFactory = ({ IDL }) => IDL.Service({
  list_namespaces:       IDL.Func([],          [IDL.Text], ['query']),
  get_stats:             IDL.Func([],          [IDL.Text], ['query']),
  list_files:            IDL.Func([IDL.Text],  [IDL.Text], ['query']),
  get_file:              IDL.Func([IDL.Text],  [IDL.Text], ['query']),
  store_file:            IDL.Func([IDL.Text],  [IDL.Text], []),
  store_file_chunk:      IDL.Func([IDL.Text],  [IDL.Text], []),
  finalize_chunked_file: IDL.Func([IDL.Text],  [IDL.Text], []),
  delete_file:           IDL.Func([IDL.Text],  [IDL.Text], []),
  delete_namespace:      IDL.Func([IDL.Text],  [IDL.Text], []),
  get_acl:               IDL.Func([],          [IDL.Text], ['query']),
  grant_publish:         IDL.Func([IDL.Text],  [IDL.Text], []),
  revoke_publish:        IDL.Func([IDL.Text],  [IDL.Text], []),
});

// ────────────────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────────────────
let authClient = null;
let actor      = null;
let principal  = '';
let _authed    = false;
let currentNs  = '';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
async function makeActor(identity) {
  const agent = await HttpAgent.create({ host: IC_HOST, identity });
  return Actor.createActor(idlFactory, { agent, canisterId: CANISTER_ID });
}

async function call(method, arg) {
  const raw = arg !== undefined
    ? await actor[method](JSON.stringify(arg))
    : await actor[method]();
  return JSON.parse(raw);
}

function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(2) + ' MB';
  return (n / 1073741824).toFixed(2) + ' GB';
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function el(id) { return document.getElementById(id); }

function showErr(msg) {
  const b = el('errBox');
  b.textContent = msg;
  b.classList.remove('hidden');
  setTimeout(() => b.classList.add('hidden'), 6000);
}

function guessContentType(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    html:'text/html', css:'text/css', js:'application/javascript',
    ts:'text/typescript', json:'application/json', md:'text/markdown',
    txt:'text/plain', py:'text/x-python', rs:'text/x-rust',
    png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
    gif:'image/gif', svg:'image/svg+xml', webp:'image/webp',
    ico:'image/x-icon', wasm:'application/wasm', pdf:'application/pdf',
    zip:'application/zip', gz:'application/gzip', toml:'text/toml',
    yaml:'text/yaml', yml:'text/yaml', sh:'text/x-sh',
  };
  return map[ext] || 'application/octet-stream';
}

function toBase64(buf) {
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// ────────────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────────────
async function initUI() {
  const id = authClient.getIdentity();
  principal = id.getPrincipal().toText();
  actor = await makeActor(id);

  _authed = principal !== '2vxsx-fae';
  el('loginBtn').classList.toggle('hidden', _authed);
  el('logoutBtn').classList.toggle('hidden', !_authed);
  const badge = el('principalBadge');
  if (_authed) {
    badge.textContent = principal.slice(0, 16) + '…';
    badge.classList.remove('hidden');
    el('globalUploadPanel').classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
    el('globalUploadPanel').classList.add('hidden');
  }
  await loadNamespaces();
}

window.handleLogin = async () => {
  await authClient.login({
    identityProvider: II_URL,
    onSuccess: async () => { await initUI(); },
  });
};

window.handleLogout = async () => {
  await authClient.logout();
  location.reload();
};

// ────────────────────────────────────────────────────────────────────────────
// Namespace list
// ────────────────────────────────────────────────────────────────────────────
window.loadNamespaces = async () => {
  el('refreshNsIcon').classList.add('spin');
  try {
    const [nsList, stats] = await Promise.all([call('list_namespaces'), call('get_stats')]);

    el('statNs').textContent    = stats.namespaces;
    el('statFiles').textContent = stats.total_files;
    el('statSize').textContent  = fmtBytes(stats.total_bytes);
    el('statsRow').classList.remove('hidden');

    const container = el('nsList');
    if (!nsList.length) {
      container.innerHTML = _authed
        ? ''
        : '<div class="text-center py-8 text-gray-500"><p>Log in to upload files.</p></div>';
    } else {
      container.innerHTML = nsList.map(ns => `
        <div onclick="showNsDetail('${esc(ns.namespace)}')"
          class="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl
                 hover:border-gray-400 hover:bg-gray-50 transition-all cursor-pointer group shadow-sm">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/>
            </svg>
            <span class="font-mono text-sm text-gray-900 group-hover:text-gray-600 transition-colors">
              ${esc(ns.namespace)}
            </span>
          </div>
          <div class="flex items-center gap-6 text-sm text-gray-500">
            <span>${fmtBytes(ns.total_bytes)}</span>
            <span>${ns.file_count} ${ns.file_count === 1 ? 'file' : 'files'}</span>
          </div>
        </div>`).join('');
    }
  } catch(e) { showErr(e.message); }
  el('refreshNsIcon').classList.remove('spin');
};

window.showNsList = () => {
  el('viewNsList').classList.remove('hidden');
  el('viewNsDetail').classList.add('hidden');
};

// ────────────────────────────────────────────────────────────────────────────
// Namespace detail
// ────────────────────────────────────────────────────────────────────────────
window.showNsDetail = (ns) => {
  currentNs = ns;
  el('viewNsList').classList.add('hidden');
  el('viewNsDetail').classList.remove('hidden');
  el('detailNsName').textContent = ns;
  if (_authed) {
    el('btnDeleteNs').classList.remove('hidden');
    el('btnDeleteNs').classList.add('flex');
    el('uploadZone').classList.remove('hidden');
  }
  loadDetail(ns);
};

window.loadDetail = async (ns) => {
  try {
    const files = await call('list_files', { namespace: ns });
    el('detailFileCount').textContent =
      `${files.length} ${files.length === 1 ? 'file' : 'files'}`;

    if (!files.length) {
      el('fileTable').innerHTML =
        '<div class="text-center py-12 text-gray-500"><p>No files in this namespace yet.</p></div>';
      return;
    }

    el('fileTable').innerHTML = `
      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
              <th class="text-left px-4 py-3">Path</th>
              <th class="text-left px-4 py-3 hidden sm:table-cell">Type</th>
              <th class="text-right px-4 py-3">Size</th>
              <th class="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${files.map(f => `
              <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3 font-mono text-xs text-gray-700">${esc(f.path)}</td>
                <td class="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">${esc(f.content_type)}</td>
                <td class="px-4 py-3 text-gray-500 text-right">${fmtBytes(f.size)}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-2">
                    <button onclick="handleDownloadFile('${esc(ns)}','${esc(f.path)}')"
                      title="Download"
                      class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-xs">
                      ⬇
                    </button>
                    <button onclick="copyFileUrl('${esc(ns)}','${esc(f.path)}')"
                      title="Copy URL"
                      class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-xs">
                      📋
                    </button>
                    ${_authed ? `
                    <button onclick="handleDeleteFile('${esc(ns)}','${esc(f.path)}')"
                      title="Delete"
                      class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors text-xs">
                      🗑
                    </button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) { showErr(e.message); }
};

window.copyFileUrl = (ns, path) => {
  const url = `https://${CANISTER_ID}.raw.icp0.io/${ns}/${path}`;
  navigator.clipboard.writeText(url);
};

window.handleDownloadFile = async (ns, path) => {
  try {
    const res = await call('get_file', { namespace: ns, path });
    if (res.error) { showErr(res.error); return; }
    const bytes = Uint8Array.from(atob(res.content_b64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: res.content_type || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) { showErr(e.message); }
};

// ────────────────────────────────────────────────────────────────────────────
// Upload
// ────────────────────────────────────────────────────────────────────────────
function setUploadMsg(msg) {
  // update both upload progress elements
  ['uploadMsg', 'globalUploadMsg'].forEach(id => {
    const e = el(id);
    if (e) e.textContent = msg;
  });
}

async function uploadBuffer(ns, filename, buf, contentType) {
  const total = Math.ceil(buf.byteLength / CHUNK_SIZE);
  if (total <= 1) {
    const res = await call('store_file', {
      namespace: ns, path: filename,
      content_b64: toBase64(buf), content_type: contentType,
    });
    if (res.error) throw new Error(res.error);
    return;
  }
  for (let i = 0; i < total; i++) {
    setUploadMsg(`Uploading ${filename} — chunk ${i + 1}/${total}`);
    const slice = buf.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const res = await call('store_file_chunk', {
      namespace: ns, path: filename,
      chunk_index: i, total_chunks: total,
      data_b64: toBase64(slice), content_type: contentType,
    });
    if (res.error) throw new Error(res.error);
  }
  setUploadMsg(`Finalizing ${filename}…`);
  const fin = await call('finalize_chunked_file', { namespace: ns, path: filename });
  if (fin.error) throw new Error(fin.error);
}

async function uploadFiles(files, targetNs, idleEl, progressEl) {
  el(idleEl).classList.add('hidden');
  el(progressEl).classList.remove('hidden');
  for (const file of files) {
    try {
      setUploadMsg(`Uploading ${file.name}…`);
      const buf = await file.arrayBuffer();
      await uploadBuffer(targetNs, file.name, buf, guessContentType(file.name));
    } catch(e) { showErr(`Upload failed for ${file.name}: ${e.message}`); }
  }
  el(idleEl).classList.remove('hidden');
  el(progressEl).classList.add('hidden');
  await loadNamespaces();
  // if we're in detail view for this namespace, also refresh it
  if (currentNs === targetNs) await loadDetail(targetNs);
}

// Namespace detail upload handlers
window.handleFileInput = (e) => uploadFiles(e.target.files, currentNs, 'uploadIdle', 'uploadProgress');
window.handleDrop = (e) => { e.preventDefault(); uploadFiles(e.dataTransfer.files, currentNs, 'uploadIdle', 'uploadProgress'); };

// Global upload panel handlers (from namespace list view)
window.handleGlobalFileInput = (e) => {
  const ns = el('globalNsInput').value.trim();
  if (!ns) { showErr('Please enter a namespace name.'); return; }
  uploadFiles(e.target.files, ns, 'globalUploadIdle', 'globalUploadProgress');
};
window.handleGlobalDrop = (e) => {
  e.preventDefault();
  const ns = el('globalNsInput').value.trim();
  if (!ns) { showErr('Please enter a namespace name.'); return; }
  uploadFiles(e.dataTransfer.files, ns, 'globalUploadIdle', 'globalUploadProgress');
};

// ────────────────────────────────────────────────────────────────────────────
// Delete
// ────────────────────────────────────────────────────────────────────────────
window.handleDeleteFile = async (ns, path) => {
  if (!confirm(`Delete ${path}?`)) return;
  try {
    const res = await call('delete_file', { namespace: ns, path });
    if (res.error) throw new Error(res.error);
    await loadDetail(ns);
    await loadNamespaces();
  } catch(e) { showErr(e.message); }
};

window.handleDeleteNamespace = async () => {
  if (!confirm(`Delete entire namespace "${currentNs}" and ALL files? This cannot be undone.`)) return;
  try {
    const res = await call('delete_namespace', { namespace: currentNs });
    if (res.error) throw new Error(res.error);
    window.showNsList();
    await loadNamespaces();
  } catch(e) { showErr(e.message); }
};

// ────────────────────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────────────────────
authClient = await AuthClient.create();
await initUI();
