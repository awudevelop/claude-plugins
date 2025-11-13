You are managing a session memory system. The user wants to decompress git history for human inspection.

## Task: Decompress Git History

Parse the session name from the command arguments. The command format is: `/session:git-decompress [name]`

### Step 1: Validate and Read Compressed File

1. Extract session name from arguments
2. Check if `.claude/sessions/{name}/git-history.json` exists
3. If not exists, show:
   ```
   ❌ Error: No git history found for session '{name}'
   💡 Git history is captured automatically at session start/continue
   💡 Or run: /session:capture-git {name}
   ```
   Then STOP.
4. Read `.claude/sessions/{name}/git-history.json`
5. Parse JSON into object

### Step 2: Expand into Human-Readable Format

Display the expanded markdown format:

```markdown
# Git History: {s}
**Captured**: {t}
**Branch**: {b}
**HEAD**: {h}

## Summary
- **Commits analyzed**: {sm.n}
- **Date range**: {sm.r}
- **Days span**: {sm.d}
- **Total files modified**: {sm.f}
- **Total changes**: {sm.ch}

## Uncommitted Changes

### Tracking Status
- **Ahead of upstream**: {uc.ah} commits
- **Behind upstream**: {uc.bh} commits

### Staged for Commit ({uc.stg.length} files)
{for each file in uc.stg:}
- `{file[0]}`: {file[1]}

### Modified (Unstaged) ({uc.mod.length} files)
{for each file in uc.mod:}
- `{file[0]}`: {file[1]}

### New Files (Untracked) ({uc.new.length} files)
{for each file in uc.new:}
- `{file}`

### Deleted Files ({uc.del.length} files)
{for each file in uc.del:}
- `{file}`

### Conflicted Files ({uc.con.length} files)
{for each file in uc.con:}
- `{file}`

**Total uncommitted changes**: {uc.tot}

## Recent Commits

{for each commit in c:}
### {commit[0]} - {commit[1]}
**Message**: {commit[2]}
**Changes**: {commit[3]}
**Files modified** ({commit[4]}):
{for each file in commit[5]:}
- `{file}`

---

## Development Hotspots

Shows directories with most commit activity:

{for each hotspot in hot:}
- **{hotspot[0]}**: {hotspot[1]} commits

---

**Note**: This is a decompressed view of the compressed JSON format used for token efficiency. The compressed format saves ~70-75% tokens compared to markdown while preserving all information.
```

### Step 3: Display Statistics

After showing the decompressed data, display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Decompression Statistics

Compressed size: {fileSize} bytes ({fileSizeKB} KB)
Estimated markdown size: ~{estimatedMarkdownSize} bytes (~{estimatedMarkdownKB} KB)
Compression efficiency: ~{compressionPercent}% smaller

Token efficiency: Compressed JSON uses ~70-75% fewer tokens than markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Usage Notes

- This command is primarily for debugging and human inspection
- Claude can read the compressed format directly (it's more efficient)
- Use this when you need to:
  - Verify git history capture is working correctly
  - Inspect what commits are included
  - Debug git context issues
  - Share git history in readable format

---

## Error Handling

- If git-history.json doesn't exist: Show helpful error with instructions
- If JSON is malformed: Show parsing error and suggest recapture
- If file is empty: Suggest running capture-git again
