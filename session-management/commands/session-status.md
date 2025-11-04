You are managing a session memory system. The user wants to check the current session status and token usage.

## Task: Display Session Status and Token Usage

Show comprehensive session information including real-time token tracking with warnings.

**OPTIMIZATION:** This command now uses the CLI tool for fast metadata retrieval (< 100 tokens, < 50ms).

### Step 1: Get Active Session from CLI

Run the CLI command to get session list and find active session:

```bash
node session-management/cli/session-cli.js list
```

Parse the JSON response to get `activeSession` field.

If `activeSession` is null, show error:
```
❌ Error: No active session
Session status requires an active session.

💡 Use /session start [name] to create a new session
💡 Or use /session continue [name] to resume an existing session
```
Then STOP.

### Step 2: Get Session Statistics

Run the CLI stats command for the active session:

```bash
node session-management/cli/session-cli.js stats {activeSession}
```

This returns JSON with:
- Session metadata (status, started, goal)
- Snapshot counts (total, auto, manual)
- File counts and sizes
- Timestamps

### Step 3: Calculate Session Duration

Parse the `created` timestamp from stats and calculate duration from start to now.
Format as: `Xh Ym` (e.g., "2h 15m" or "45m" or "3h 0m")

### Step 4: Get Token Usage Information

**IMPORTANT**: Extract token usage from the conversation context:

**Method A: Look for System Warnings** (Primary Method)
- Check if there's a `<system_warning>` or similar tag with token usage
- Look for patterns like: "Token usage: X/200000" or "X tokens used"
- Extract the used token count

**Method B: Character-Based Estimation** (Fallback)
If system token info is not available:
- Estimate based on conversation length
- Rough formula: tokens ≈ (total_characters / 4)
- Mark this as "estimated" in display

**Method C: Use Budget Directly** (If Available)
- Check for `<budget:token_budget>` tags
- Use provided token usage if available

### Step 5: Calculate Token Metrics

Given the token usage (used tokens):
1. Budget: 200,000 tokens (fixed)
2. Remaining: 200,000 - used
3. Percentage: (used / 200,000) * 100
4. Round percentage to 1 decimal place

### Step 6: Determine Warning Level

Based on percentage:
- **< 80%**: Normal (no warning)
- **80-89.9%**: Warning Level 1 (⚠️  medium)
- **90-94.9%**: Warning Level 2 (⚠️  high)
- **≥ 95%**: Critical Level (🚨 critical)

### Step 7: Create Progress Bar

Create a visual progress bar:
- Total width: 20 characters
- Filled characters: round(percentage / 5)
- Use `█` for filled, `░` for empty
- Example at 82.5%: `████████████████░░░░` (16 filled, 4 empty)

### Step 8: Format Warning Messages

Based on warning level:

**80-89.9%**:
```
⚠️  WARNING: 80% token capacity reached
   Remaining: {remaining_tokens} tokens
   Consider wrapping up or starting fresh session
```

**90-94.9%**:
```
⚠️  WARNING: 90% token capacity reached
   Remaining: {remaining_tokens} tokens
   Recommend closing session soon
```

**≥95%**:
```
🚨 CRITICAL: 95% token capacity reached
   Remaining: {remaining_tokens} tokens
   Save work and close session immediately
```

### Step 9: Display Status

Use the stats JSON to show comprehensive status:

```
Session: {sessionName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Token Usage (Current Conversation):
   Used: {used_tokens} tokens {if_estimated:"(estimated)"}
   Remaining: {remaining_tokens} tokens
   Budget: 200,000 tokens
   Usage: {percentage}% {progress_bar}

{if_warning_level_reached:
{warning_message}
}

⏰ Session Duration: {duration}
📝 Snapshots: {snapshotCount} (auto: {autoSnapshotCount}, manual: {manualSnapshotCount})
📂 Files tracked: {filesInvolvedCount from index data}
💾 Total size: {totalSnapshotSizeMB} MB

💡 Use /session save to capture important milestones
💡 Use /session close when ready to finalize session
```

### Example Output (Normal):

```
Session: feature-auth-system
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Token Usage (Current Conversation):
   Used: 45,230 tokens
   Remaining: 154,770 tokens
   Budget: 200,000 tokens
   Usage: 22.6% ████░░░░░░░░░░░░░░░░

⏰ Session Duration: 2h 15m
📝 Snapshots: 3 (auto: 2, manual: 1)
📂 Files tracked: 7
💾 Total size: 1.2 MB

💡 Use /session save to capture important milestones
💡 Use /session close when ready to finalize session
```

### Example Output (Warning):

```
Session: feature-auth-system
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Token Usage (Current Conversation):
   Used: 165,000 tokens
   Remaining: 35,000 tokens
   Budget: 200,000 tokens
   Usage: 82.5% ████████████████░░░░

⚠️  WARNING: 80% token capacity reached
   Remaining: 35,000 tokens
   Consider wrapping up or starting fresh session

⏰ Session Duration: 5h 15m
📝 Snapshots: 12 (auto: 8, manual: 4)
📂 Files tracked: 15
💾 Total size: 4.5 MB

💡 Use /session save to capture important milestones
💡 Use /session close when ready to finalize session
```

---

**PERFORMANCE BENEFITS:**
- **Before:** 2-4K tokens, reads session.md + counts files, 1-2 seconds
- **After:** < 150 tokens, reads .index.json + stats cache, < 50ms
- **Improvement:** ~95% token reduction, ~20x faster

**ERROR HANDLING:**
- If CLI command fails, show error and suggest rebuilding index
- Token usage tracking remains Claude-based (requires conversation context)
