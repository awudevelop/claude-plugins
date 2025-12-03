# Project Maps Stats Command

Show compression statistics for project maps.

## Usage

```
/project-maps-stats
```

## Implementation

### Step 1: Run Stats Command

Execute the unified CLI:

```bash
node ${CLAUDE_PLUGIN_ROOT}/cli/session-cli.js project-maps stats
```

### Step 2: Parse JSON Response

The response includes:
- `success`: Boolean indicating success
- `projectHash`: Hash of the project
- `mapsDirectory`: Location of maps
- `stats`: Compression statistics
  - `totalOriginal`: Total original size
  - `totalCompressed`: Total compressed size
  - `totalRatio`: Overall compression ratio
  - `maps`: Array of per-map statistics

### Step 3: Display Results

Format the output:

```
Project Maps Statistics

Project: {projectHash}
Location: {mapsDirectory}

Map Compression:
  Map Name                Original    Compressed  Ratio
  ------------------------------------------------
  summary.json            {size}      {size}      {ratio}
  tree.json               {size}      {size}      {ratio}
  metadata.json           {size}      {size}      {ratio}
  content-summaries.json  {size}      {size}      {ratio}
  indices.json            {size}      {size}      {ratio}
  existence-proofs.json   {size}      {size}      {ratio}
  quick-queries.json      {size}      {size}      {ratio}
  dependencies-forward    {size}      {size}      {ratio}
  dependencies-reverse    {size}      {size}      {ratio}
  relationships.json      {size}      {size}      {ratio}
  issues.json             {size}      {size}      {ratio}
  ------------------------------------------------
  Total                   {total}     {total}     {ratio}

Compression achieved: {totalRatio}
```

### Step 4: Show Recommendations

If compression ratio is low:
```
Tip: Consider regenerating maps for better compression
Run: /project-maps-refresh --full
```

## Error Handling

If maps don't exist:
```
No maps found for this project.
Run: /project-maps-generate
```

If stats cannot be calculated:
```
Unable to calculate statistics.
Some map files may be corrupt.
Try regenerating: /project-maps-refresh --full
```

## Notes

- Stats are calculated on-demand
- Compression levels: minification, key abbreviation, deduplication
- Target compression ratio: 40-60%
