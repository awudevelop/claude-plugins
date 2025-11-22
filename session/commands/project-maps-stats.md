# Project Maps Stats Command

Show compression metrics and system statistics for project maps.

## Usage

```
/project-maps-stats
```

## Implementation

### Step 1: Scan All Project Maps

Scan the maps directory and collect statistics:

```bash
du -sh ~/.claude/project-maps/
ls -lR ~/.claude/project-maps/ | wc -l
```

### Step 2: Calculate Compression Metrics

For each project, read compression metadata:

```javascript
const allStats = {
  totalProjects: 0,
  totalFiles: 0,
  totalMaps: 0,
  originalSize: 0,
  compressedSize: 0,
  totalStorage: 0
};

// Aggregate from all summary.json files
for (const projectHash of projectHashes) {
  const summary = await loadSummary(projectHash);
  allStats.totalFiles += summary.statistics.totalFiles;
  // ... aggregate other stats
}
```

### Step 3: Display Statistics

Show comprehensive system stats:

```
Project Maps Statistics

System Overview:
  Projects mapped: {project_count}
  Total files scanned: {total_files}
  Total maps generated: {total_maps}
  Storage location: ~/.claude/project-maps/

Storage Metrics:
  Total storage used: {total_storage} MB
  Original data size: {original_size} MB
  Compressed size: {compressed_size} MB
  Space saved: {space_saved} MB ({savings_percent}%)

Compression Efficiency:
  Average compression ratio: {avg_ratio}%
  Best compression: {best_ratio}% ({project_name})
  Worst compression: {worst_ratio}% ({project_name})

  Compression breakdown:
    • Level 1 (minification): {level1_ratio}%
    • Level 2 (key abbreviation): {level2_ratio}%
    • Level 3 (deduplication): {level3_ratio}%

Map Distribution:
  • Per project: 11 maps (fixed)
  • Total maps: {total_maps}

Performance:
  • Average generation time: {avg_gen_time}ms
  • Average map size: {avg_map_size} KB
  • Staleness distribution:
      Fresh (0-30): {fresh_count} projects
      Moderate (30-60): {moderate_count} projects
      Critical (60+): {critical_count} projects

Recommendations:
  ⚠️  {stale_count} projects need refresh
  ✓  Storage efficiency: {efficiency}%
  💡 Consider cleaning old maps: /project-maps-clean
```

### Step 4: Per-Project Breakdown

Optionally show detailed per-project stats:

```
Per-Project Breakdown:

1. {project_name}
   Maps: 11
   Original: {original_size} KB
   Compressed: {compressed_size} KB
   Ratio: {ratio}%
   Staleness: {score}/100

2. {project_name}
   Maps: 11
   Original: {original_size} KB
   Compressed: {compressed_size} KB
   Ratio: {ratio}%
   Staleness: {score}/100
```

## Error Handling

**No maps found:**
```
No project maps found

Generate maps first:
  /project-maps-generate
```

**Cannot calculate stats:**
```
⚠️  Unable to calculate complete statistics

Some map files may be corrupt or inaccessible.
Try regenerating maps for affected projects.
```

## Examples

```bash
# Show system statistics
/project-maps-stats

# Show detailed per-project stats
/project-maps-stats --detailed
```
