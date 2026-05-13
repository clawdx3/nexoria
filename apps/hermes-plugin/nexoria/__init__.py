"""Nexoria Hermes plugin registration."""

import logging
from pathlib import Path

from . import schemas, tools

logger = logging.getLogger(__name__)


def _on_post_tool_call(tool_name, args, result, task_id, **kwargs):
    if tool_name.startswith("nexoria_"):
        logger.debug("Nexoria plugin tool called: %s session=%s", tool_name, task_id)


def register(ctx):
    ctx.register_tool(
        name="nexoria_create_task",
        toolset="nexoria",
        schema=schemas.NEXORIA_CREATE_TASK,
        handler=tools.nexoria_create_task,
    )
    ctx.register_tool(
        name="nexoria_list_tasks",
        toolset="nexoria",
        schema=schemas.NEXORIA_LIST_TASKS,
        handler=tools.nexoria_list_tasks,
    )
    ctx.register_tool(
        name="nexoria_update_task",
        toolset="nexoria",
        schema=schemas.NEXORIA_UPDATE_TASK,
        handler=tools.nexoria_update_task,
    )
    ctx.register_tool(
        name="nexoria_create_memory",
        toolset="nexoria",
        schema=schemas.NEXORIA_CREATE_MEMORY,
        handler=tools.nexoria_create_memory,
    )
    ctx.register_tool(
        name="nexoria_search_memory",
        toolset="nexoria",
        schema=schemas.NEXORIA_SEARCH_MEMORY,
        handler=tools.nexoria_search_memory,
    )
    ctx.register_hook("post_tool_call", _on_post_tool_call)

    skill_md = Path(__file__).parent / "skills" / "nexoria-runtime" / "SKILL.md"
    if skill_md.exists():
        ctx.register_skill("nexoria-runtime", skill_md)
