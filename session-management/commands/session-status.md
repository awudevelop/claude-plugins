You are managing a session memory system. The user wants to check the current session status and token usage.

## Task: Display Session Status and Token Usage

Show comprehensive session information including real-time token tracking with warnings.

### Step 1: Check for Active Session

1. Check if `.claude/sessions/.active-session` file exists
2. If NOT exists, show error:
   ```
   ❌ Error: No active session
   Session status requires an active session.

   💡 Use /session start [name] to create a new session
   💡 Or use /session continue [name] to resume an existing session
   ```
   Then STOP.
3. Read the active session name from `.active-session`

### Step 2: Read Session Metadata

1. Read `.claude/sessions/{active_session}/session.md`
2. Extract:
   - Started timestamp
   - Last Updated timestamp
   - Goal
   - Status

### Step 3: Calculate Session Duration

1. Parse the "Started" timestamp
2. Calculate duration from start to now
3. Format as: `Xh Ym` (e.g., "2h 15m" or "45m" or "3h 0m")

### Step 4: Count Session Activity

1. Count snapshot files in `.claude/sessions/{active_session}/` (files matching `YYYY-MM-DD_HH-MM.md`)
2. Count distinct files mentioned in session.md "Files Involved" section
3. Count milestones in session.md (total and completed)

### Step 5: Get Token Usage Information

**IMPORTANT**: Try to extract token usage from the conversation context:

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

### Step 6: Calculate Token Metrics

Given the token usage (used tokens):
1. Budget: 200,000 tokens (fixed)
2. Remaining: 200,000 - used
3. Percentage: (used / 200,000) * 100
4. Round percentage to 1 decimal place

### Step 7: Determine Warning Level

Based on percentage:
- **< 80%**: Normal (no warning)
- **80-89.9%**: Warning Level 1 (⚠️  medium)
- **90-94.9%**: Warning Level 2 (⚠️  high)
- **≥ 95%**: Critical Level (🚨 critical)

### Step 8: Create Progress Bar

Create a visual progress bar:
- Total width: 20 characters
- Filled characters: round(percentage / 5)
- Use `█` for filled, `░` for empty
- Example at 82.5%: `████████████████░░░░` (16 filled, 4 empty)

### Step 9: Format Warning Messages

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

### Step 10: Display Status

Show comprehensive status:

```
Session: {session_name}
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
📝 Snapshots: {snapshot_count}
📂 Files tracked: {file_count}
✅ Milestones: {completed_milestones}/{total_milestones}

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
📝 Snapshots: 3
📂 Files tracked: 7
✅ Milestones: 2/5

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
📝 Snapshots: 12
📂 Files tracked: 15
✅ Milestones: 8/10

💡 Use /session save to capture important milestones
💡 Use /session close when ready to finalize session
```

---

**IMPORTANT**:
- Try to get accurate token usage from system information
- If not available, use estimation but mark it clearly
- Format numbers with thousands separators (e.g., 45,230)
- Color/emoji indicators help visual scanning
- Always show actionable next steps
- Duration calculation should be accurate
- Progress bar should be visually clear
