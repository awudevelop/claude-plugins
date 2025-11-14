You are managing a session memory system. The user wants to check the current session status.

## Task: Display Session Status (Ultra-Minimal)

Show essential session information quickly and efficiently.

**OPTIMIZATION:** Ultra-minimal output. Uses CLI for instant stats (<50ms, <50 tokens).

### Step 1: Get Active Session from CLI

Run the CLI command to get session list and find active session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js list
```

Parse the JSON response to get `activeSession` field.

If `activeSession` is null, show error:
```
❌ No active session

💡 /session:start [name] to create new session
💡 /session:continue [name] to resume existing session
```
Then STOP.

### Step 2: Get Session Statistics

Run the CLI stats command for the active session:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js stats {activeSession}
```

This returns JSON with:
- Session metadata (status, started, lastUpdated, goal)
- Snapshot counts (snapshotCount)
- File counts (filesInvolvedCount)

### Step 3: Calculate Session Duration

Parse the `started` timestamp from stats (format: "2025-11-13 14:30").

Calculate duration from start time to now:
1. Parse started date/time
2. Calculate difference in minutes
3. Format as:
   - If < 60 min: "Xm" (e.g., "45m")
   - If < 24 hours: "Xh Ym" (e.g., "2h 15m" or "5h 0m")
   - If >= 24 hours: "Xd Yh" (e.g., "2d 3h")

### Step 4: Calculate Time Since Last Activity

Parse `lastUpdated` timestamp (ISO format: "2025-11-14T10:27:04.345Z").

Calculate time since last update:
1. Parse ISO timestamp
2. Calculate difference from now
3. Format as relative time:
   - "just now" (< 1 min)
   - "Xm ago" (< 60 min)
   - "Xh ago" (< 24 hours)
   - "Xd ago" (>= 24 hours)

### Step 5: Display Ultra-Minimal Status

Show clean, essential information only:

```
✓ Session: {sessionName} ({status})
  Working for: {duration} (started {started_short})
  Snapshots: {snapshotCount} total
  Files: {filesInvolvedCount} tracked
  Last activity: {time_since_last_update}

💡 /session:save to capture milestones
💡 /session:close to finalize
```

**Format notes:**
- {status}: "active" or "closed"
- {started_short}: "Nov 14, 14:30" format
- All numbers: plain integers (no formatting)
- No emojis except status indicator (✓)
- No Unicode art, no progress bars
- 5 lines max

### Example Output

**Active session:**
```
✓ Session: feature-auth (active)
  Working for: 2h 15m (started Nov 14, 14:30)
  Snapshots: 12 total
  Files: 7 tracked
  Last activity: 30m ago

💡 /session:save to capture milestones
💡 /session:close to finalize
```

**Recently started:**
```
✓ Session: bug-fix-login (active)
  Working for: 15m (started Nov 14, 18:45)
  Snapshots: 1 total
  Files: 2 tracked
  Last activity: just now

💡 /session:save to capture milestones
💡 /session:close to finalize
```

**Closed session:**
```
✓ Session: refactor-api (closed)
  Worked for: 5h 30m (started Nov 13, 09:00)
  Snapshots: 18 total
  Files: 12 tracked
  Last activity: 2d ago

💡 /session:continue {sessionName} to resume
```

---

**PERFORMANCE:**
- **Tokens:** ~50 tokens (vs 150 before) - **66% reduction**
- **Speed:** <50ms (CLI delegation)
- **Lines:** 5-7 lines (vs 15-20 before) - **70% reduction**

**WHAT WAS REMOVED:**
- ❌ Token usage tracking (unreliable, verbose)
- ❌ Progress bars (unnecessary decoration)
- ❌ Warning messages (not reliable)
- ❌ Unicode art (bloat)
- ❌ Total size display (rarely useful)
- ❌ Auto vs manual snapshot breakdown (not essential)

**WHAT WAS KEPT:**
- ✅ Session name and status
- ✅ Duration (how long working)
- ✅ Snapshot count (progress indicator)
- ✅ File count (scope indicator)
- ✅ Last activity (freshness indicator)
- ✅ Quick action tips

**FOR TOKEN USAGE:** Users should run `/context` directly for accurate real-time token information.

**ERROR HANDLING:**
- If CLI command fails, show error and suggest rebuilding index
- If timestamps can't be parsed, show raw values
