<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { agents, fetchAgents } = useAgent()

onMounted(async () => {
  await fetchAgents()
  const first = agents.value[0]
  await navigateTo(`/chat/${first?.id || 'orchestrator'}`, { replace: true })
})
</script>
