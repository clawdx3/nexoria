<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">Integrations</h1>
      <p class="text-slate-500 mt-1">Connect your business tools to power the AI agents.</p>
    </div>
    <div class="space-y-4">
      <UCard v-for="i in integrations" :key="i.type">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <component :is="i.icon" class="h-5 w-5" />
            </div>
            <div>
              <h3 class="font-semibold">{{ i.name }}</h3>
              <p class="text-sm text-slate-500">{{ i.description }}</p>
            </div>
          </div>
          <UBadge :color="i.connected ? 'green' : 'gray'">{{ i.connected ? 'Connected' : 'Not connected' }}</UBadge>
        </div>
      </UCard>
    </div>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const integrations = [
  { type: 'shopify', name: 'Shopify', description: 'Product catalog and inventory', icon: 'ShoppingBag', connected: false },
  { type: 'gmail', name: 'Gmail', description: 'Read emails and draft replies', icon: 'Mail', connected: false },
  { type: 'facebook', name: 'Facebook / Instagram', description: 'Create and publish posts', icon: 'Facebook', connected: false },
  { type: 'mailerlite', name: 'MailerLite', description: 'Newsletters and campaigns', icon: 'Send', connected: false },
]
</script>
