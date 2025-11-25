#!/usr/bin/env node
/**
 * Sync phase files with execution-state.json (source of truth)
 * Usage: node sync-phase-files.js <plan-name>
 */

const fs = require('fs').promises;
const path = require('path');
const progressService = require('../services/progress-service');

async function syncPhaseFiles(planName) {
  const planDir = progressService.getPlanDir(planName);

  // Get execution state (source of truth)
  const state = await progressService.getExecutionState(planName);
  console.log('Task statuses from execution-state.json:', Object.keys(state.taskStatuses).length, 'tasks');

  // Read orchestration
  const orchPath = path.join(planDir, 'orchestration.json');
  const orchestration = JSON.parse(await fs.readFile(orchPath, 'utf-8'));

  let fixedTasks = 0;
  let fixedPhases = 0;

  // Update each phase file
  for (const phase of orchestration.phases) {
    const phasePath = path.join(planDir, phase.file);
    try {
      const phaseData = JSON.parse(await fs.readFile(phasePath, 'utf-8'));

      let updated = false;
      for (const task of phaseData.tasks) {
        const correctStatus = state.taskStatuses[task.task_id] || 'pending';
        if (task.status !== correctStatus) {
          console.log('  Fixing', task.task_id, ':', task.status, '->', correctStatus);
          task.status = correctStatus;
          updated = true;
          fixedTasks++;
        }
      }

      // Update phase status
      const phaseStatus = state.phaseStatuses[phase.id] || 'pending';
      if (phaseData.status !== phaseStatus) {
        console.log('  Fixing phase', phase.id, ':', phaseData.status, '->', phaseStatus);
        phaseData.status = phaseStatus;
        updated = true;
        fixedPhases++;
      }

      if (updated) {
        await fs.writeFile(phasePath, JSON.stringify(phaseData, null, 2));
      }
    } catch (err) {
      console.error('Error with phase', phase.id, ':', err.message);
    }
  }

  console.log('\nSync completed:');
  console.log('  Fixed tasks:', fixedTasks);
  console.log('  Fixed phases:', fixedPhases);
}

const planName = process.argv[2] || 'update-plan';
syncPhaseFiles(planName).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
