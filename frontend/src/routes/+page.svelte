<script>
  import { onMount } from 'svelte';
  import { listNamespaces, getStats, formatBytes } from '$lib/api.js';
  import { isAuthenticated } from '$lib/auth.js';
  import { FolderOpen, Package, HardDrive, RefreshCw, AlertCircle } from 'lucide-svelte';

  let namespaces = [];
  let stats = null;
  let loading = true;
  let error = '';

  async function load() {
    loading = true;
    error = '';
    try {
      [namespaces, stats] = await Promise.all([listNamespaces(), getStats()]);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<svelte:head><title>IC File Registry</title></svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">File Registry</h1>
      <p class="text-gray-400 text-sm mt-1">On-chain file storage on the Internet Computer</p>
    </div>
    <button
      on:click={load}
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
    >
      <RefreshCw class="w-4 h-4 {loading ? 'animate-spin' : ''}" /> Refresh
    </button>
  </div>

  <!-- Stats -->
  {#if stats}
    <div class="grid grid-cols-3 gap-4">
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div class="text-gray-400 text-xs uppercase tracking-wider mb-1">Namespaces</div>
        <div class="text-2xl font-bold text-white">{stats.namespaces}</div>
      </div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div class="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Files</div>
        <div class="text-2xl font-bold text-white">{stats.total_files}</div>
      </div>
      <div class="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <div class="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Size</div>
        <div class="text-2xl font-bold text-white">{formatBytes(stats.total_bytes)}</div>
      </div>
    </div>
  {/if}

  <!-- Error -->
  {#if error}
    <div class="flex items-center gap-2 p-4 rounded-xl bg-red-900/30 border border-red-700 text-red-300">
      <AlertCircle class="w-5 h-5 shrink-0" />
      <span class="text-sm">{error}</span>
    </div>
  {/if}

  <!-- Namespace list -->
  <div>
    <h2 class="text-lg font-semibold text-gray-200 mb-3">Namespaces</h2>
    {#if loading && namespaces.length === 0}
      <div class="flex items-center gap-2 text-gray-500 py-8 justify-center">
        <RefreshCw class="w-4 h-4 animate-spin" /> Loading...
      </div>
    {:else if namespaces.length === 0}
      <div class="text-center py-12 text-gray-500">
        <Package class="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>No namespaces yet.</p>
        {#if $isAuthenticated}
          <p class="text-sm mt-1">Upload a file to create the first namespace.</p>
        {:else}
          <p class="text-sm mt-1">Log in to upload files.</p>
        {/if}
      </div>
    {:else}
      <div class="grid gap-3">
        {#each namespaces as ns (ns.namespace)}
          <a
            href="/{encodeURIComponent(ns.namespace)}"
            class="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-700 hover:bg-gray-800 transition-all group"
          >
            <div class="flex items-center gap-3">
              <FolderOpen class="w-5 h-5 text-blue-400 shrink-0" />
              <div>
                <div class="font-mono text-sm text-white group-hover:text-blue-300 transition-colors">
                  {ns.namespace}
                </div>
                {#if ns.description}
                  <div class="text-xs text-gray-400 mt-0.5">{ns.description}</div>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-6 text-sm text-gray-400">
              <span class="flex items-center gap-1">
                <HardDrive class="w-3.5 h-3.5" />
                {formatBytes(ns.total_bytes)}
              </span>
              <span>{ns.file_count} {ns.file_count === 1 ? 'file' : 'files'}</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
