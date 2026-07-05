import json, urllib.request, os, sys

TOKEN = os.environ["TELEGRAM_TOKEN"]
CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

# Read filename from argument (passed by workflow)
if len(sys.argv) < 2:
    print("ERROR: No filename argument")
    exit(1)

filename = sys.argv[1]
if not os.path.exists(filename):
    print(f"ERROR: File not found: {filename}")
    exit(1)

print(f"Sending: {filename}")
with open(filename, "r") as f:
    message = f.read()

chunks = [message[i:i+4000] for i in range(0, len(message), 4000)]
for chunk in chunks:
    data = json.dumps({"chat_id": CHAT_ID, "text": chunk, "disable_web_page_preview": True}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{TOKEN}/sendMessage",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read().decode())
        print(f"ok={result.get('ok')}, msg_id={result.get('result', {}).get('message_id')}")
