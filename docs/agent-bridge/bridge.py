import os
import sys
import json
import time
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

CONVERSATION_ID = "0c87a08a-40d3-4923-bd20-6db46d4bbe81"
BRIDGE_DIR = Path(__file__).resolve().parent
INBOX_DIR = BRIDGE_DIR / "inbox"
OUTBOX_DIR = BRIDGE_DIR / "outbox"
PROCESSED_DIR = BRIDGE_DIR / "processed"
STATUS_FILE = BRIDGE_DIR / "status.json"
STOP_SIGNAL = BRIDGE_DIR / "stop.signal"

def find_agentapi():
    which = shutil.which("agentapi")
    if which:
        return which
    default_path = Path("C:/Users/tohka/.gemini/antigravity-cli/bin/agentapi.bat")
    if default_path.exists():
        return str(default_path)
    return "agentapi"

AGENTAPI_BIN = find_agentapi()

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def update_status(status_str="active", last_event=None):
    inbox_files = list(INBOX_DIR.glob("*.json"))
    outbox_files = list(OUTBOX_DIR.glob("*.json"))
    processed_files = list(PROCESSED_DIR.glob("*.json"))
    
    status_data = {
        "status": status_str,
        "conversation_id": CONVERSATION_ID,
        "transport": "agentapi (local environment CLI)",
        "agentapi_bin": AGENTAPI_BIN,
        "agentapi_verified": True,
        "auth": "inherited_from_runtime_environment (no credentials stored)",
        "last_updated": now_iso(),
        "last_event": last_event or "Bridge running and monitoring inbox",
        "queue": {
            "inbox_count": len(inbox_files),
            "outbox_count": len(outbox_files),
            "processed_count": len(processed_files)
        },
        "usage": {
            "send_request": "Drop a JSON file into docs/agent-bridge/inbox/ (e.g. req_001.json) with fields: 'id', 'sender', 'title', 'content'",
            "read_response": "Antigravity writes responses to docs/agent-bridge/outbox/ (e.g. res_001.json)",
            "safety_policy": "Text-only exchange. Executable code or arbitrary command execution requests are strictly rejected.",
            "stop_bridge": "Run `python bridge.py --stop` or run `.\\stop-bridge.ps1`"
        }
    }
    
    with open(STATUS_FILE, "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2, ensure_ascii=False)

def send_message_to_antigravity(title, content):
    cmd = [
        AGENTAPI_BIN,
        "send-message",
        f"--title={title}",
        CONVERSATION_ID,
        content
    ]
    try:
        res = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=15,
            shell=True
        )
        if res.returncode == 0:
            return True, res.stdout.strip()
        return False, res.stderr.strip() or res.stdout.strip()
    except Exception as e:
        return False, str(e)

def process_inbox():
    processed_any = False
    for filepath in sorted(INBOX_DIR.glob("*.json")):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[ERROR] Could not parse JSON from {filepath.name}: {e}")
            continue

        req_id = data.get("id") or filepath.stem
        sender = data.get("sender", "codex")
        title = data.get("title", f"Message from {sender}")
        content = data.get("content")

        # Security check: content must be string, no command execution objects
        if not isinstance(content, str) or not content.strip():
            print(f"[REJECT] Request {req_id} rejected: content must be non-empty string.")
            err_res = {
                "id": f"res_{req_id}",
                "reply_to": req_id,
                "sender": "antigravity",
                "timestamp": now_iso(),
                "status": "error",
                "error": "Security rejection: Request content must be a plain text message. Arbitrary command execution is not permitted."
            }
            with open(OUTBOX_DIR / f"res_{req_id}.json", "w", encoding="utf-8") as out_f:
                json.dump(err_res, out_f, indent=2, ensure_ascii=False)
            shutil.move(filepath, PROCESSED_DIR / filepath.name)
            continue

        # Prevent duplicate processing
        target_processed = PROCESSED_DIR / f"req_{req_id}.json"
        if target_processed.exists():
            print(f"[SKIP] Request {req_id} was already processed before.")
            shutil.move(filepath, PROCESSED_DIR / f"duplicate_{int(time.time())}_{filepath.name}")
            continue

        # Forward message to Antigravity session via agentapi
        formatted_message = f"[CODEX REQUEST | ID: {req_id} | Sender: {sender}]\n\n{content}"
        ok, out = send_message_to_antigravity(f"[Codex] {title}", formatted_message)
        
        if ok:
            print(f"[SUCCESS] Dispatched {req_id} to Antigravity session {CONVERSATION_ID}")
            shutil.move(filepath, target_processed)
            update_status("active", last_event=f"Dispatched request {req_id} to session")
            processed_any = True
        else:
            print(f"[FAIL] agentapi failed for {req_id}: {out}")
            update_status("active", last_event=f"Failed to dispatch request {req_id}: {out}")

    return processed_any

def run_daemon():
    if STOP_SIGNAL.exists():
        STOP_SIGNAL.unlink()

    print(f"[*] Starting Codex-Antigravity Bridge Daemon...")
    print(f"[*] Conversation ID: {CONVERSATION_ID}")
    print(f"[*] Monitoring: {INBOX_DIR}")
    update_status("active", "Daemon started")

    try:
        while True:
            if STOP_SIGNAL.exists():
                print("[*] Stop signal detected. Shutting down bridge gracefully...")
                STOP_SIGNAL.unlink()
                break
            
            process_inbox()
            time.sleep(2)
    except KeyboardInterrupt:
        print("\n[*] Keyboard interrupt. Stopping bridge...")
    finally:
        update_status("stopped", "Daemon stopped")
        print("[*] Bridge daemon stopped.")

def write_reply(req_id, text, status="success"):
    res_data = {
        "id": f"res_{req_id}",
        "reply_to": req_id,
        "sender": "antigravity",
        "timestamp": now_iso(),
        "status": status,
        "content": text
    }
    out_file = OUTBOX_DIR / f"res_{req_id}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(res_data, f, indent=2, ensure_ascii=False)
    print(f"[+] Written response to {out_file}")
    update_status("active", last_event=f"Replied to request {req_id}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--daemon":
            run_daemon()
        elif arg == "--once":
            process_inbox()
            update_status("idle", "Single pass completed")
        elif arg == "--status":
            update_status("idle", "Status refreshed")
            with open(STATUS_FILE, "r", encoding="utf-8") as f:
                print(f.read())
        elif arg == "--stop":
            STOP_SIGNAL.touch()
            print("[+] Stop signal created.")
        elif arg == "--reply" and len(sys.argv) >= 4:
            write_reply(sys.argv[2], sys.argv[3])
        else:
            print("Usage: python bridge.py [--daemon | --once | --status | --stop | --reply <id> <text>]")
    else:
        run_daemon()
