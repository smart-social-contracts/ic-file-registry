<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    listFiles, uploadFile, deleteFile, grantPublish, revokePublish,
    deleteNamespace, getAcl, fileUrl, guessContentType, formatBytes,
  } from '$lib/api.js';
  import { isAuthenticated, principal } from '$lib/auth.js';
  import {
    ArrowLeft, Upload, Trash2, Copy, Check, AlertCircle,
    RefreshCw, FileText, Shield, UserPlus, UserMinus, FolderX,
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  $: namespace = decodeURIComponent($page.params.namespace);

  let files = [];
  let acl = {};
  let loading = true;
  let error = '';
  let uploading = false;
  let uploadProgress = { current: 0, total: 0, filename: '' };
  let copiedPath = '';
  let showAcl = false;
  let newPrincipal = '';
  let aclError = '';

  async function load() {
    loading = true;
    error = '';
    try {
      [files, acl] = await Promise.all([
        listFiles(namespace),
        getAcl(),
      ]);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);

  async function handleFileUpload(e) {
    const fileList = e.target?.files ?? e.dataTransfer?.files;
    if (!fileList?.length) return;
    uploading = true;
    error = '';
    for (const file of fileList) {
      try {
        uploadProgress = { current: 0, total: 1, filename: file.name };
        const buf = await file.arrayBuffer();
        const ct = guessContentType(file.name);
        await uploadFile(namespace, file.name, buf, ct, (c, t) => {
          uploadProgress = { current: c, total: t, filename: file.name };
        });
      } catch (e) {
        error = `Upload failed for ${file.name}: ${e.message}`;
      }
    }
    uploading = false;
    await load();
  }

  async function handleDelete(path) {
    if (!confirm(`Delete ${path}?`)) return;
    try {
      await deleteFile(namespace, path);
      await load();
    } catch (e) {
      error = e.message;
    }
  }

  async function handleDeleteNamespace() {
    if (!confirm(`Delete entire namespace "${namespace}" and ALL its files? This cannot be undone.`)) return;
    try {
      await deleteNamespace(namespace);
      goto('/');
    } catch (e) {
      error = e.message;
    }
  }

  async function handleGrant() {
    aclError = '';
    try {
      await grantPublish(namespace, newPrincipal.trim());
      newPrincipal = '';
      const fresh = await getAcl();
      acl = fresh;
    } catch (e) {
      aclError = e.message;
    }
  }

  async function handleRevoke(p) {
    try {
      await revokePublish(namespace, p);
      const fresh = await getAcl();
      acl = fresh;
    } catch (e) {
      aclError = e.message;
    }
  }

  function copyUrl(path) {
    const url = fileUrl(namespace, path);
    navigator.clipboard.writeText(url);
    copiedPath = path;
    setTimeout(() => (copiedPath = ''), 2000);
  }

  let dragOver = false;
  function onDragOver(e) { e.preventDefault(); dragOver = true; }
  function onDragLeave() { dragOver = false; }
  function onDrop(e) { e.preventDefault(); dragOver = false; handleFileUpload(e); }

  $: nsAcl = acl[namespace] ?? [];
</script>

<svelte:head><title>{namespace} — IC File Registry</title></svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <a href="/" class="text-gray-400 hover:text-white transition-colors">
        <ArrowLeft class="w-5 h-5" />
      </a>
      <div>
        <h1 class="text-xl font-bold text-white font-mono">{namespace}</h1>
        <p class="text-xs text-gray-500 mt-0.5">{files.length} {files.length === 1 ? 'file' : 'files'}</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button on:click={load} class="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
        <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" />
      </button>
      {#if $isAuthenticated}
        <button
          on:click={() => showAcl = !showAcl}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
        >
          <Shield class="w-4 h-4" /> ACL
        </button>
        <button
          on:click={handleDeleteNamespace}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 text-sm transition-colors"
        >
          <FolderX class="w-4 h-4" /> Delete namespace
        </button>
      {/if}
    </div>
  </div>

  <!-- Error -->
  {#if error}
    <div class="flex items-center gap-2 p-4 rounded-xl bg-red-900/30 border border-red-700 text-red-300">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span class="text-sm">{error}</span>
    </div>
  {/if}

  <!-- ACL panel -->
  {#if showAcl}
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
      <h3 class="font-semibold text-gray-200 flex items-center gap-2">
        <Shield class="w-4 h-4 text-yellow-400" /> Publisher Access Control
      </h3>
      {#if aclError}
        <p class="text-red-400 text-sm">{aclError}</p>
      {/if}
      {#if nsAcl.length === 0}
        <p class="text-gray-500 text-sm">No publishers granted. Controllers always have access.</p>
      {:else}
        <ul class="space-y-1">
          {#each nsAcl as p (p)}
            <li class="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
              <span class="font-mono text-xs text-gray-300">{p}</span>
              <button on:click={() => handleRevoke(p)} class="text-gray-500 hover:text-red-400 transition-colors">
                <UserMinus class="w-4 h-4" />
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="flex gap-2">
        <input
          bind:value={newPrincipal}
          placeholder="Principal ID"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
        <button
          on:click={handleGrant}
          class="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
        >
          <UserPlus class="w-4 h-4" /> Grant
        </button>
      </div>
    </div>
  {/if}

  <!-- Upload zone -->
  {#if $isAuthenticated}
    <div
      role="region"
      aria-label="File upload area"
      class="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer
             {dragOver ? 'border-blue-500 bg-blue-900/10' : 'border-gray-700 hover:border-gray-500'}"
      on:dragover={onDragOver}
      on:dragleave={onDragLeave}
      on:drop={onDrop}
    >
      {#if uploading}
        <div class="space-y-2">
          <RefreshCw class="w-8 h-8 mx-auto text-blue-400 animate-spin" />
          <p class="text-sm text-gray-400">
            Uploading {uploadProgress.filename}
            {#if uploadProgress.total > 1}
              (chunk {uploadProgress.current}/{uploadProgress.total})
            {/if}
          </p>
        </div>
      {:else}
        <Upload class="w-8 h-8 mx-auto text-gray-500 mb-3" />
        <p class="text-gray-400 text-sm mb-3">Drag & drop files here, or</p>
        <label class="cursor-pointer">
          <span class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors">
            Choose files
          </span>
          <input type="file" multiple class="hidden" on:change={handleFileUpload} />
        </label>
        <p class="text-xs text-gray-600 mt-3">Files &gt; 500 KB are uploaded in chunks automatically.</p>
      {/if}
    </div>
  {/if}

  <!-- File list -->
  {#if loading && files.length === 0}
    <div class="flex items-center gap-2 text-gray-500 py-8 justify-center">
      <RefreshCw class="w-4 h-4 animate-spin" /> Loading...
    </div>
  {:else if files.length === 0}
    <div class="text-center py-12 text-gray-500">
      <FileText class="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>No files in this namespace yet.</p>
    </div>
  {:else}
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
            <th class="text-left px-4 py-3">Path</th>
            <th class="text-left px-4 py-3">Type</th>
            <th class="text-right px-4 py-3">Size</th>
            <th class="text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each files as file (file.path)}
            <tr class="border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors">
              <td class="px-4 py-3 font-mono text-xs text-blue-300">{file.path}</td>
              <td class="px-4 py-3 text-gray-400 text-xs">{file.content_type}</td>
              <td class="px-4 py-3 text-gray-400 text-right">{formatBytes(file.size)}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <button
                    on:click={() => copyUrl(file.path)}
                    title="Copy URL"
                    class="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    {#if copiedPath === file.path}
                      <Check class="w-4 h-4 text-green-400" />
                    {:else}
                      <Copy class="w-4 h-4" />
                    {/if}
                  </button>
                  {#if $isAuthenticated}
                    <button
                      on:click={() => handleDelete(file.path)}
                      title="Delete file"
                      class="p-1.5 rounded-lg hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
