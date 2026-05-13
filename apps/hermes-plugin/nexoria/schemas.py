"""Tool schemas exposed to Hermes by the Nexoria plugin."""

NEXORIA_CREATE_TASK = {
    "name": "nexoria_create_task",
    "description": (
        "Create a canonical Nexoria workspace task. Use this instead of local notes "
        "when work should be tracked in Nexoria."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Short action-oriented task title."},
            "description": {"type": "string", "description": "Optional task details."},
            "priority": {
                "type": "string",
                "enum": ["low", "medium", "high", "urgent"],
                "description": "Task priority. Use medium unless urgency is explicit.",
            },
        },
        "required": ["title"],
    },
}

NEXORIA_LIST_TASKS = {
    "name": "nexoria_list_tasks",
    "description": "List canonical Nexoria tasks in the active workspace.",
    "parameters": {
        "type": "object",
        "properties": {
            "status": {
                "type": "string",
                "enum": ["pending", "in_progress", "done", "cancelled"],
                "description": "Optional status filter.",
            },
        },
    },
}

NEXORIA_UPDATE_TASK = {
    "name": "nexoria_update_task",
    "description": "Update a canonical Nexoria task status, title, description, or priority.",
    "parameters": {
        "type": "object",
        "properties": {
            "taskId": {"type": "string", "description": "UUID of the task to update."},
            "status": {"type": "string", "enum": ["pending", "in_progress", "done", "cancelled"]},
            "priority": {"type": "string", "enum": ["low", "medium", "high", "urgent"]},
            "title": {"type": "string"},
            "description": {"type": "string"},
        },
        "required": ["taskId"],
    },
}

NEXORIA_CREATE_MEMORY = {
    "name": "nexoria_create_memory",
    "description": (
        "Persist durable user, workspace, customer, or business memory to Nexoria. "
        "Use this instead of Hermes local memory for shared or UI-visible facts."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "content": {"type": "string", "description": "Single memory sentence."},
            "type": {"type": "string", "enum": ["fact", "preference", "avoidance", "pattern"]},
            "tier": {"type": "string", "enum": ["session", "daily", "long_term"]},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        },
        "required": ["content", "type"],
    },
}

NEXORIA_SEARCH_MEMORY = {
    "name": "nexoria_search_memory",
    "description": "Search canonical Nexoria memory before answering questions about user or workspace history.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query."},
            "limit": {"type": "number", "description": "Maximum results, default 5."},
        },
        "required": ["query"],
    },
}
