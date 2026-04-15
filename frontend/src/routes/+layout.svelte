<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { initAuth, login, logout, isAuthenticated, principal } from '$lib/auth.js';
  import { LogIn, LogOut, Database } from 'lucide-svelte';

  onMount(() => initAuth());
</script>

<div class="min-h-screen bg-gray-950 text-gray-100">
  <nav class="border-b border-gray-800 bg-gray-900">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 text-white font-semibold text-lg hover:text-blue-400 transition-colors">
        <Database class="w-5 h-5 text-blue-400" />
        IC File Registry
      </a>

      <div class="flex items-center gap-4">
        {#if $isAuthenticated}
          <span class="text-xs text-gray-400 font-mono truncate max-w-[200px]" title={$principal}>
            {$principal.slice(0, 12)}...
          </span>
          <button
            on:click={logout}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-colors"
          >
            <LogOut class="w-4 h-4" /> Log out
          </button>
        {:else}
          <button
            on:click={login}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
          >
            <LogIn class="w-4 h-4" /> Login with Internet Identity
          </button>
        {/if}
      </div>
    </div>
  </nav>

  <main class="max-w-6xl mx-auto px-4 py-8">
    <slot />
  </main>
</div>
