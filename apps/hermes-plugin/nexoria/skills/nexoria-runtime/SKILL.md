# Nexoria Runtime

Use this skill when running inside Nexoria through the Hermes runner.

Nexoria is the source of truth for workspace tasks, approvals, chat, and durable memory. Use `nexoria_*` tools for shared workspace side effects and memory. Use Hermes local memory only for runner-local operational lessons that should not appear in Nexoria.

When the user asks to remember customer, business, workspace, or preference information, call `nexoria_create_memory`. Before answering questions about prior workspace context, call `nexoria_search_memory`.
