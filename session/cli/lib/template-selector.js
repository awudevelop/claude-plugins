const fs = require('fs').promises;
const path = require('path');

// Template mapping
const TEMPLATE_MAP = {
  feature: 'feature-template.json',
  bug: 'bug-template.json',
  spike: 'spike-template.json',
  refactor: 'refactor-template.json'
};

// Default template (fallback)
const DEFAULT_TEMPLATE = 'feature-template.json';

/**
 * Selects template based on work type
 */
async function selectTemplate(workType, options = {}) {
  const {
    allowFallback = true,
    customPath = null
  } = options;

  // Handle custom template path
  if (customPath) {
    try {
      const template = await loadTemplate(customPath);
      return {
        template,
        path: customPath,
        type: 'custom'
      };
    } catch (error) {
      if (!allowFallback) {
        throw new Error(`Custom template not found: ${customPath}`);
      }
      // Fall through to default selection
    }
  }

  // Get template filename
  const templateFile = TEMPLATE_MAP[workType] || DEFAULT_TEMPLATE;
  const templateDir = path.join(__dirname, '../../templates');
  const templatePath = path.join(templateDir, templateFile);

  try {
    const template = await loadTemplate(templatePath);

    if (!validateTemplate(template)) {
      throw new Error(`Invalid template structure: ${templateFile}`);
    }

    return {
      template,
      path: templatePath,
      type: workType
    };
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }

    // Fallback to default template
    const defaultPath = path.join(templateDir, DEFAULT_TEMPLATE);
    const defaultTemplate = await loadTemplate(defaultPath);

    return {
      template: defaultTemplate,
      path: defaultPath,
      type: 'feature' // Default type
    };
  }
}

/**
 * Loads template file
 */
async function loadTemplate(templatePath) {
  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Template not found: ${templatePath}`);
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in template: ${templatePath}`);
    }
    throw error;
  }
}

/**
 * Validates template structure
 */
function validateTemplate(template) {
  // Required fields
  const requiredFields = ['work_type', 'phases', 'version'];

  for (const field of requiredFields) {
    if (!template[field]) {
      console.error(`Missing required field: ${field}`);
      return false;
    }
  }

  // Validate phases structure
  if (!Array.isArray(template.phases)) {
    console.error('Phases must be an array');
    return false;
  }

  // Validate each phase
  for (const phase of template.phases) {
    if (!phase.phase_name || !Array.isArray(phase.tasks)) {
      console.error('Invalid phase structure');
      return false;
    }

    // Validate each task
    for (const task of phase.tasks) {
      if (!task.task_id || !task.description) {
        console.error('Invalid task structure');
        return false;
      }
    }
  }

  return true;
}

/**
 * Lists all available templates
 */
async function listTemplates() {
  const templateDir = path.join(__dirname, '../../templates');

  try {
    const files = await fs.readdir(templateDir);
    return files
      .filter(f => f.endsWith('-template.json'))
      .map(f => f.replace('-template.json', ''));
  } catch (error) {
    console.error('Error listing templates:', error);
    return [];
  }
}

/**
 * Gets template metadata without loading full template
 */
async function getTemplateMetadata(workType) {
  const templateFile = TEMPLATE_MAP[workType];
  if (!templateFile) {
    return null;
  }

  const templatePath = path.join(__dirname, '../../templates', templateFile);

  try {
    const template = await loadTemplate(templatePath);
    return {
      type: workType,
      phaseCount: template.phases.length,
      taskCount: template.phases.reduce((sum, p) => sum + p.tasks.length, 0),
      version: template.version
    };
  } catch (error) {
    return null;
  }
}

module.exports = {
  selectTemplate,
  loadTemplate,
  validateTemplate,
  listTemplates,
  getTemplateMetadata,
  TEMPLATE_MAP
};
