"""Nexoria plugin tool handlers.

Handlers return JSON strings and never raise, matching the Hermes plugin contract.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request


def _config():
    return {
        "api_url": os.environ.get("NEXORIA_API_URL", "http://api:3000/api/v1").rstrip("/"),
        "token": (
            os.environ.get("NEXORIA_AGENT_TOKEN")
            or os.environ.get("NEXORIA_PRO_AGENT_TOKEN")
            or os.environ.get("NEXORIA_MCP_TOKEN", "")
        ),
        "workspace_id": os.environ.get("NEXORIA_WORKSPACE_ID", ""),
    }


def _request(method, path, payload=None):
    cfg = _config()
    if not cfg["workspace_id"]:
        return {"success": False, "error": "NEXORIA_WORKSPACE_ID is not configured"}
    url = f"{cfg['api_url']}{path}"
    body = json.dumps(payload or {}).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {cfg['token']}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            text = res.read().decode("utf-8")
            return json.loads(text) if text else {"success": True}
    except urllib.error.HTTPError as exc:
        return {"success": False, "error": f"HTTP {exc.code}: {exc.read().decode('utf-8', 'ignore')}"}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def nexoria_create_task(args: dict, **kwargs) -> str:
    cfg = _config()
    result = _request(
        "POST",
        f"/workspaces/{cfg['workspace_id']}/tasks",
        {
            "title": args.get("title"),
            "description": args.get("description"),
            "priority": args.get("priority") or "medium",
            "metadata": {"createdByTool": "hermes-plugin:nexoria_create_task"},
        },
    )
    return json.dumps(result)


def nexoria_list_tasks(args: dict, **kwargs) -> str:
    cfg = _config()
    qs = ""
    if args.get("status"):
        qs = "?" + urllib.parse.urlencode({"status": args["status"]})
    return json.dumps(_request("GET", f"/workspaces/{cfg['workspace_id']}/tasks{qs}"))


def nexoria_update_task(args: dict, **kwargs) -> str:
    cfg = _config()
    task_id = args.get("taskId")
    if not task_id:
        return json.dumps({"success": False, "error": "taskId is required"})
    patch = {k: v for k, v in args.items() if k in {"status", "priority", "title", "description"} and v is not None}
    return json.dumps(_request("PATCH", f"/workspaces/{cfg['workspace_id']}/tasks/{task_id}", patch))


def nexoria_create_memory(args: dict, **kwargs) -> str:
    cfg = _config()
    payload = {
        "content": args.get("content"),
        "type": args.get("type"),
        "tier": args.get("tier") or "long_term",
        "confidence": args.get("confidence", 0.9),
        "metadata": {"source": "hermes-plugin:nexoria_create_memory"},
    }
    return json.dumps(_request("POST", f"/workspaces/{cfg['workspace_id']}/memory", payload))


def nexoria_search_memory(args: dict, **kwargs) -> str:
    cfg = _config()
    payload = {"query": args.get("query"), "limit": args.get("limit") or 5}
    return json.dumps(_request("POST", f"/workspaces/{cfg['workspace_id']}/memory/search", payload))
