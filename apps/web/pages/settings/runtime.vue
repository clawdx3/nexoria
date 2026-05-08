<template>
  <div class="max-w-5xl space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">OpenClaw Runtime</h1>
      <p class="mt-1 text-sm text-slate-500">Managed agent computer status, jobs, and generated files.</p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <UCard>
        <div class="text-xs uppercase tracking-wide text-slate-500">Runner</div>
        <div class="mt-2 flex items-center gap-2">
          <span :class="['h-2 w-2 rounded-full', runtimeOnline ? 'bg-emerald-500' : 'bg-amber-500']"></span>
          <span class="text-lg font-semibold">{{ status?.status || 'offline' }}</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">{{ status?.instance?.instanceKey || 'No runner registered' }}</p>
      </UCard>

      <UCard>
        <div class="text-xs uppercase tracking-wide text-slate-500">Jobs</div>
        <div class="mt-2 text-lg font-semibold">{{ jobs.length }}</div>
        <p class="mt-2 text-xs text-slate-500">Recent managed OpenClaw runs</p>
      </UCard>

      <UCard>
        <div class="text-xs uppercase tracking-wide text-slate-500">Artifacts</div>
        <div class="mt-2 text-lg font-semibold">{{ artifacts.length }}</div>
        <p class="mt-2 text-xs text-slate-500">Files returned from runtime jobs</p>
      </UCard>
    </div>

    <UCard>
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Run a managed job</h2>
          <p class="text-sm text-slate-500">The runner will reject agents outside the backend allowlist.</p>
        </div>
        <UButton :loading="isLoading" color="gray" variant="soft" @click="fetchRuntime">Refresh</UButton>
      </div>

      <div class="grid gap-3 md:grid-cols-[260px_1fr_auto]">
        <USelectMenu
          v-model="selectedAgentId"
          :options="agentOptions"
          value-attribute="id"
          option-attribute="name"
          placeholder="Select approved agent"
        />
        <UInput v-model="prompt" placeholder="Ask OpenClaw to create a file or complete a task..." />
        <UButton color="cyan" :loading="submitting" :disabled="!selectedAgentId || !prompt.trim()" @click="submitJob">
          Run
        </UButton>
      </div>
    </UCard>

    <UCard>
      <h2 class="mb-4 text-lg font-semibold">Recent jobs</h2>
      <div v-if="jobs.length === 0" class="text-sm text-slate-500">No runtime jobs yet.</div>
      <div v-else class="divide-y divide-slate-200 dark:divide-slate-800">
        <div v-for="job in jobs" :key="job.id" class="flex items-center justify-between gap-4 py-3">
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{{ job.input?.prompt || job.input?.message || job.type }}</div>
            <div class="mt-1 text-xs text-slate-500">{{ job.agentProfileId }} · {{ job.createdAt ? new Date(job.createdAt).toLocaleString() : '' }}</div>
          </div>
          <UBadge :color="statusColor(job.status)" variant="soft">{{ job.status }}</UBadge>
        </div>
      </div>
    </UCard>

    <UCard>
      <h2 class="mb-4 text-lg font-semibold">Artifacts</h2>
      <div v-if="artifacts.length === 0" class="text-sm text-slate-500">Generated files will appear here.</div>
      <div v-else class="grid gap-3 md:grid-cols-2">
        <a
          v-for="artifact in artifacts"
          :key="artifact.id"
          :href="artifactUrl(artifact)"
          target="_blank"
          class="rounded-lg border border-slate-200 p-4 transition hover:border-cyan-400 dark:border-slate-800"
        >
          <div class="truncate text-sm font-semibold">{{ artifact.filename }}</div>
          <div class="mt-1 text-xs text-slate-500">{{ artifact.mimeType }} · {{ formatBytes(artifact.sizeBytes) }}</div>
        </a>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const { enabledAgents, fetchAgents } = useAgent()
const { status, jobs, artifacts, isLoading, fetchRuntime, createJob, artifactUrl } = useManagedRuntime()

const selectedAgentId = ref('orchestrator')
const prompt = ref('Create a short markdown file named openclaw-test.md that says the managed runtime is working.')
const submitting = ref(false)

const runtimeOnline = computed(() => status.value?.status === 'ready')
const agentOptions = computed(() => [
  { id: 'orchestrator', name: 'Orchestrator' },
  ...enabledAgents.value.map((agent: any) => ({ id: agent.id, name: agent.name }))
])

onMounted(() => {
  void fetchAgents()
  void fetchRuntime()
})

async function submitJob () {
  submitting.value = true
  try {
    await createJob({
      agentProfileId: selectedAgentId.value,
      type: 'openclaw_task',
      input: { prompt: prompt.value },
      limits: {
        timeoutSeconds: 300,
        maxOutputFiles: 5,
        maxArtifactBytes: 10485760,
        allowedExtensions: ['.txt', '.md', '.csv', '.json', '.html']
      }
    })
    toast.add({ title: 'Runtime job queued', color: 'green' })
    await fetchRuntime()
  } catch (err: any) {
    toast.add({ title: 'Failed to queue job', description: err?.data?.message || err?.message || '', color: 'red' })
  } finally {
    submitting.value = false
  }
}

function statusColor (status: string): string {
  switch (status) {
    case 'completed': return 'green'
    case 'running': return 'blue'
    case 'failed':
    case 'rejected': return 'red'
    default: return 'gray'
  }
}

function formatBytes (bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
