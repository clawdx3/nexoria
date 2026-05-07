<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">Integrations</h1>
      <p class="text-slate-500 mt-1">Connect your business tools to power the AI agents.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <UCard v-for="integration in integrations" :key="integration.type">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg"
              :class="integration.bgClass"
            >
              <component :is="integration.icon" class="h-6 w-6" :class="integration.iconClass" />
            </div>
            <div>
              <h3 class="font-semibold">{{ integration.name }}</h3>
              <p class="text-sm text-slate-500">{{ integration.description }}</p>
              <UBadge
                :color="integration.connected ? 'green' : 'gray'"
                size="xs"
                class="mt-2"
              >
                {{ integration.connected ? 'Connected' : 'Not connected' }}
              </UBadge>
            </div>
          </div>
          <UButton
            :color="integration.connected ? 'red' : 'primary'"
            variant="soft"
            size="sm"
            @click="toggleIntegration(integration)"
          >
            {{ integration.connected ? 'Disconnect' : 'Connect' }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ShoppingBag, Mail, Facebook, Send } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { integrations, connect, disconnect } = useIntegrations()

const integrationCards = computed(() => [
  {
    type: 'shopify',
    name: 'Shopify',
    description: 'Sync product catalog, inventory, and orders.',
    icon: ShoppingBag,
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    connected: integrations.value.some(i => i.type === 'shopify' && i.status === 'active'),
  },
  {
    type: 'gmail',
    name: 'Gmail',
    description: 'Read emails, draft replies, and check inboxes.',
    icon: Mail,
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    iconClass: 'text-red-600 dark:text-red-400',
    connected: integrations.value.some(i => i.type === 'gmail' && i.status === 'active'),
  },
  {
    type: 'facebook',
    name: 'Facebook / Instagram',
    description: 'Create and publish posts and stories.',
    icon: Facebook,
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    iconClass: 'text-blue-600 dark:text-blue-400',
    connected: integrations.value.some(i => i.type === 'facebook' && i.status === 'active'),
  },
  {
    type: 'mailerlite',
    name: 'MailerLite',
    description: 'Draft and send newsletters and campaigns.',
    icon: Send,
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    iconClass: 'text-amber-600 dark:text-amber-400',
    connected: integrations.value.some(i => i.type === 'mailerlite' && i.status === 'active'),
  },
])

async function toggleIntegration(card: any) {
  if (card.connected) {
    await disconnect(card.type)
  } else {
    await connect(card.type)
  }
}
</script>
