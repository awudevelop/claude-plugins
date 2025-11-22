const fs = require('fs').promises;
const path = require('path');

/**
 * Frontend Framework Detector for project context maps
 * Detects frontend framework (React, Vue, Angular, Svelte) and analyzes component architecture
 *
 * Detection strategies:
 * 1. Config files (next.config.js, vue.config.js, angular.json, svelte.config.js)
 * 2. Package.json dependencies
 * 3. File patterns (JSX/TSX, .vue, .svelte, Angular decorators)
 * 4. Component patterns (hooks, lifecycle, state management)
 */

class FrameworkDetector {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.framework = null;
    this.stateManagement = [];
    this.componentPatterns = {
      react: {
        hooks: false,
        classComponents: false,
        functionalComponents: false
      },
      vue: {
        composition: false,
        options: false,
        scriptSetup: false
      },
      angular: {
        components: false,
        services: false,
        modules: false
      },
      svelte: {
        stores: false,
        reactiveStatements: false
      }
    };
  }

  /**
   * Detect frontend framework from scanned files and package.json
   */
  async detectFramework(scannedFiles) {
    // Strategy 1: Check for framework-specific config files
    const configDetection = this.detectByConfigFiles(scannedFiles);
    if (configDetection) {
      this.framework = configDetection;
    }

    // Strategy 2: Check package.json dependencies
    if (!this.framework) {
      const packageDetection = await this.detectByPackageJson(scannedFiles);
      if (packageDetection) {
        this.framework = packageDetection;
      }
    }

    // Strategy 3: Check file extensions and patterns
    if (!this.framework) {
      const fileDetection = this.detectByFilePatterns(scannedFiles);
      if (fileDetection) {
        this.framework = fileDetection;
      }
    }

    // Detect state management solutions
    await this.detectStateManagement(scannedFiles);

    // Analyze component patterns
    await this.analyzeComponentPatterns(scannedFiles);

    return {
      framework: this.framework || { name: 'Unknown', type: 'unknown' },
      stateManagement: this.stateManagement,
      componentPatterns: this.componentPatterns[this.framework?.type?.split('-')[0]] || {}
    };
  }

  /**
   * Detect framework by config files
   */
  detectByConfigFiles(scannedFiles) {
    const fileNames = scannedFiles.map(f => f.name.toLowerCase());

    // Next.js (React meta-framework)
    if (fileNames.includes('next.config.js') || fileNames.includes('next.config.ts') ||
        fileNames.includes('next.config.mjs')) {
      return { name: 'Next.js', type: 'react-framework', version: 'unknown' };
    }

    // Nuxt.js (Vue meta-framework)
    if (fileNames.includes('nuxt.config.js') || fileNames.includes('nuxt.config.ts')) {
      return { name: 'Nuxt.js', type: 'vue-framework', version: 'unknown' };
    }

    // Angular
    if (fileNames.includes('angular.json')) {
      return { name: 'Angular', type: 'angular-framework', version: 'unknown' };
    }

    // Vue
    if (fileNames.includes('vue.config.js') || fileNames.includes('vue.config.ts')) {
      return { name: 'Vue.js', type: 'vue-framework', version: 'unknown' };
    }

    // Svelte
    if (fileNames.includes('svelte.config.js') || fileNames.includes('svelte.config.ts')) {
      return { name: 'Svelte', type: 'svelte-framework', version: 'unknown' };
    }

    // SvelteKit
    if (fileNames.some(f => f.includes('svelte.config'))) {
      return { name: 'SvelteKit', type: 'svelte-framework', version: 'unknown' };
    }

    // Remix (React)
    if (fileNames.includes('remix.config.js') || fileNames.includes('remix.config.ts')) {
      return { name: 'Remix', type: 'react-framework', version: 'unknown' };
    }

    return null;
  }

  /**
   * Detect framework by package.json dependencies
   */
  async detectByPackageJson(scannedFiles) {
    const packageFile = scannedFiles.find(f => f.name === 'package.json' && !f.relativePath.includes('node_modules'));

    if (!packageFile) {
      return null;
    }

    try {
      const content = await fs.readFile(packageFile.path, 'utf8');
      const packageJson = JSON.parse(content);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // React
      if (deps['react']) {
        if (deps['next']) {
          return { name: 'Next.js', type: 'react-framework', version: deps['next'] };
        }
        if (deps['@remix-run/react']) {
          return { name: 'Remix', type: 'react-framework', version: deps['@remix-run/react'] };
        }
        return { name: 'React', type: 'react', version: deps['react'] };
      }

      // Vue
      if (deps['vue']) {
        if (deps['nuxt']) {
          return { name: 'Nuxt.js', type: 'vue-framework', version: deps['nuxt'] };
        }
        return { name: 'Vue.js', type: 'vue', version: deps['vue'] };
      }

      // Angular
      if (deps['@angular/core']) {
        return { name: 'Angular', type: 'angular', version: deps['@angular/core'] };
      }

      // Svelte
      if (deps['svelte']) {
        if (deps['@sveltejs/kit']) {
          return { name: 'SvelteKit', type: 'svelte-framework', version: deps['@sveltejs/kit'] };
        }
        return { name: 'Svelte', type: 'svelte', version: deps['svelte'] };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect framework by file patterns
   */
  detectByFilePatterns(scannedFiles) {
    const extensions = scannedFiles.map(f => f.extension);
    const types = scannedFiles.map(f => f.type);

    // Count file types
    const jsxCount = types.filter(t => t === 'javascript-react' || t === 'typescript-react').length;
    const vueCount = extensions.filter(e => e === 'vue').length;
    const svelteCount = extensions.filter(e => e === 'svelte').length;

    // Angular detection by file content patterns
    const angularFiles = scannedFiles.filter(f =>
      f.name.endsWith('.component.ts') ||
      f.name.endsWith('.module.ts') ||
      f.name.endsWith('.service.ts')
    ).length;

    // Determine framework by file counts
    if (jsxCount > 5) {
      return { name: 'React', type: 'react', version: 'unknown' };
    }
    if (vueCount > 3) {
      return { name: 'Vue.js', type: 'vue', version: 'unknown' };
    }
    if (svelteCount > 3) {
      return { name: 'Svelte', type: 'svelte', version: 'unknown' };
    }
    if (angularFiles > 5) {
      return { name: 'Angular', type: 'angular', version: 'unknown' };
    }

    return null;
  }

  /**
   * Detect state management solutions
   */
  async detectStateManagement(scannedFiles) {
    const packageFile = scannedFiles.find(f => f.name === 'package.json' && !f.relativePath.includes('node_modules'));

    if (!packageFile) {
      return;
    }

    try {
      const content = await fs.readFile(packageFile.path, 'utf8');
      const packageJson = JSON.parse(content);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // React state management
      if (deps['redux'] || deps['@reduxjs/toolkit']) {
        this.stateManagement.push({ name: 'Redux', type: 'global', version: deps['redux'] || deps['@reduxjs/toolkit'] });
      }
      if (deps['mobx']) {
        this.stateManagement.push({ name: 'MobX', type: 'global', version: deps['mobx'] });
      }
      if (deps['recoil']) {
        this.stateManagement.push({ name: 'Recoil', type: 'global', version: deps['recoil'] });
      }
      if (deps['zustand']) {
        this.stateManagement.push({ name: 'Zustand', type: 'global', version: deps['zustand'] });
      }
      if (deps['jotai']) {
        this.stateManagement.push({ name: 'Jotai', type: 'global', version: deps['jotai'] });
      }
      if (deps['@tanstack/react-query'] || deps['react-query']) {
        this.stateManagement.push({ name: 'React Query', type: 'server', version: deps['@tanstack/react-query'] || deps['react-query'] });
      }

      // Vue state management
      if (deps['vuex']) {
        this.stateManagement.push({ name: 'Vuex', type: 'global', version: deps['vuex'] });
      }
      if (deps['pinia']) {
        this.stateManagement.push({ name: 'Pinia', type: 'global', version: deps['pinia'] });
      }

      // Angular state management
      if (deps['@ngrx/store']) {
        this.stateManagement.push({ name: 'NgRx', type: 'global', version: deps['@ngrx/store'] });
      }
      if (deps['@ngxs/store']) {
        this.stateManagement.push({ name: 'NGXS', type: 'global', version: deps['@ngxs/store'] });
      }

      // Svelte state management
      if (deps['svelte/store']) {
        this.stateManagement.push({ name: 'Svelte Stores', type: 'global', version: 'built-in' });
      }

    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Analyze component patterns in the codebase
   */
  async analyzeComponentPatterns(scannedFiles) {
    if (!this.framework) return;

    const frameworkType = this.framework.type.split('-')[0];

    // Get component files
    const componentFiles = scannedFiles.filter(f =>
      this.isComponentFile(f, frameworkType)
    );

    // Sample up to 20 components for pattern analysis
    const sampleSize = Math.min(20, componentFiles.length);
    const sampledFiles = this.sampleFiles(componentFiles, sampleSize);

    for (const file of sampledFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf8');
        this.analyzeComponentContent(content, frameworkType);
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  /**
   * Check if file is a component file
   */
  isComponentFile(file, frameworkType) {
    const fileName = file.name.toLowerCase();
    const relativePath = file.relativePath.toLowerCase();

    switch (frameworkType) {
      case 'react':
        return (file.type === 'javascript-react' || file.type === 'typescript-react') ||
               (fileName.endsWith('.jsx') || fileName.endsWith('.tsx')) ||
               relativePath.includes('/components/');

      case 'vue':
        return file.extension === 'vue';

      case 'angular':
        return fileName.endsWith('.component.ts');

      case 'svelte':
        return file.extension === 'svelte';

      default:
        return false;
    }
  }

  /**
   * Analyze component content for patterns
   */
  analyzeComponentContent(content, frameworkType) {
    switch (frameworkType) {
      case 'react':
        this.analyzeReactPatterns(content);
        break;
      case 'vue':
        this.analyzeVuePatterns(content);
        break;
      case 'angular':
        this.analyzeAngularPatterns(content);
        break;
      case 'svelte':
        this.analyzeSveltePatterns(content);
        break;
    }
  }

  /**
   * Analyze React component patterns
   */
  analyzeReactPatterns(content) {
    // Detect hooks
    if (content.match(/\b(useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef)\b/)) {
      this.componentPatterns.react.hooks = true;
      this.componentPatterns.react.functionalComponents = true;
    }

    // Detect class components
    if (content.match(/class\s+\w+\s+extends\s+(React\.)?Component/)) {
      this.componentPatterns.react.classComponents = true;
    }

    // Detect functional components
    if (content.match(/(?:const|function)\s+\w+\s*=\s*(?:\([^)]*\)|[^=])*=>/)) {
      this.componentPatterns.react.functionalComponents = true;
    }
  }

  /**
   * Analyze Vue component patterns
   */
  analyzeVuePatterns(content) {
    // Detect Composition API
    if (content.match(/\bsetup\s*\(/) || content.match(/<script\s+setup>/)) {
      this.componentPatterns.vue.composition = true;
    }

    // Detect script setup
    if (content.match(/<script\s+setup>/)) {
      this.componentPatterns.vue.scriptSetup = true;
    }

    // Detect Options API
    if (content.match(/export\s+default\s*{\s*(data|methods|computed|watch|mounted)/)) {
      this.componentPatterns.vue.options = true;
    }
  }

  /**
   * Analyze Angular component patterns
   */
  analyzeAngularPatterns(content) {
    // Detect components
    if (content.match(/@Component\s*\(/)) {
      this.componentPatterns.angular.components = true;
    }

    // Detect services
    if (content.match(/@Injectable\s*\(/)) {
      this.componentPatterns.angular.services = true;
    }

    // Detect modules
    if (content.match(/@NgModule\s*\(/)) {
      this.componentPatterns.angular.modules = true;
    }
  }

  /**
   * Analyze Svelte component patterns
   */
  analyzeSveltePatterns(content) {
    // Detect stores
    if (content.match(/import\s+.*\s+from\s+['"]svelte\/store['"]/)) {
      this.componentPatterns.svelte.stores = true;
    }

    // Detect reactive statements
    if (content.match(/\$:\s+\w+/)) {
      this.componentPatterns.svelte.reactiveStatements = true;
    }
  }

  /**
   * Sample files randomly
   */
  sampleFiles(files, sampleSize) {
    if (files.length <= sampleSize) {
      return files;
    }

    const sampled = [];
    const indices = new Set();

    while (sampled.length < sampleSize) {
      const index = Math.floor(Math.random() * files.length);
      if (!indices.has(index)) {
        indices.add(index);
        sampled.push(files[index]);
      }
    }

    return sampled;
  }

  /**
   * Extract component metadata from a file
   * Returns: { props, state, hooks, lifecycle, exports }
   */
  async extractComponentMetadata(filePath, content = null) {
    const ext = path.extname(filePath).slice(1);

    if (!content) {
      try {
        content = await fs.readFile(filePath, 'utf8');
      } catch (error) {
        return null;
      }
    }

    if (this.isJavaScriptFile(ext)) {
      return this.extractReactMetadata(content);
    } else if (ext === 'vue') {
      return this.extractVueMetadata(content);
    } else if (ext === 'svelte') {
      return this.extractSvelteMetadata(content);
    }

    return null;
  }

  /**
   * Check if file is JavaScript/TypeScript
   */
  isJavaScriptFile(ext) {
    return ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext);
  }

  /**
   * Extract React component metadata
   */
  extractReactMetadata(content) {
    const metadata = {
      props: [],
      state: [],
      hooks: [],
      lifecycle: [],
      exports: []
    };

    // Extract props (TypeScript interface or PropTypes)
    const propTypesMatch = content.match(/(\w+)\.propTypes\s*=\s*{([^}]+)}/s);
    if (propTypesMatch) {
      const propsContent = propTypesMatch[2];
      const propMatches = propsContent.matchAll(/(\w+):\s*PropTypes\.\w+/g);
      for (const match of propMatches) {
        metadata.props.push(match[1]);
      }
    }

    // TypeScript props interface
    const interfaceMatch = content.match(/interface\s+\w*Props\s*{([^}]+)}/s);
    if (interfaceMatch) {
      const propsContent = interfaceMatch[1];
      const propMatches = propsContent.matchAll(/(\w+)\??:\s*[\w\[\]<>|]+/g);
      for (const match of propMatches) {
        metadata.props.push(match[1]);
      }
    }

    // Extract hooks
    const hookMatches = content.matchAll(/\b(useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef|useImperativeHandle|useLayoutEffect|useDebugValue)\b/g);
    const hooks = new Set();
    for (const match of hookMatches) {
      hooks.add(match[1]);
    }
    metadata.hooks = Array.from(hooks);

    // Extract state (useState)
    const stateMatches = content.matchAll(/const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/g);
    for (const match of stateMatches) {
      metadata.state.push(match[1]);
    }

    // Extract lifecycle methods (class components)
    const lifecycleMethods = ['componentDidMount', 'componentDidUpdate', 'componentWillUnmount', 'shouldComponentUpdate', 'getDerivedStateFromProps'];
    for (const method of lifecycleMethods) {
      if (content.includes(method)) {
        metadata.lifecycle.push(method);
      }
    }

    // Extract exports
    const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:class|function|const)\s+(\w+)/g);
    for (const match of exportMatches) {
      metadata.exports.push(match[1]);
    }

    return metadata;
  }

  /**
   * Extract Vue component metadata
   */
  extractVueMetadata(content) {
    const metadata = {
      props: [],
      data: [],
      computed: [],
      methods: [],
      lifecycle: [],
      exports: []
    };

    // Extract props
    const propsMatch = content.match(/props:\s*{([^}]+)}/s) || content.match(/props:\s*\[([^\]]+)\]/);
    if (propsMatch) {
      const propsContent = propsMatch[1];
      const propMatches = propsContent.matchAll(/['"]?(\w+)['"]?:/g);
      for (const match of propMatches) {
        metadata.props.push(match[1]);
      }
    }

    // Extract data properties
    const dataMatch = content.match(/data\s*\(\s*\)\s*{[^}]*return\s*{([^}]+)}/s);
    if (dataMatch) {
      const dataContent = dataMatch[1];
      const dataMatches = dataContent.matchAll(/(\w+):/g);
      for (const match of dataMatches) {
        metadata.data.push(match[1]);
      }
    }

    // Extract computed properties
    const computedMatch = content.match(/computed:\s*{([^}]+)}/s);
    if (computedMatch) {
      const computedContent = computedMatch[1];
      const computedMatches = computedContent.matchAll(/(\w+)\s*\(/g);
      for (const match of computedMatches) {
        metadata.computed.push(match[1]);
      }
    }

    // Extract methods
    const methodsMatch = content.match(/methods:\s*{([^}]+)}/s);
    if (methodsMatch) {
      const methodsContent = methodsMatch[1];
      const methodMatches = methodsContent.matchAll(/(\w+)\s*\(/g);
      for (const match of methodMatches) {
        metadata.methods.push(match[1]);
      }
    }

    // Extract lifecycle hooks
    const lifecycleHooks = ['created', 'mounted', 'updated', 'destroyed', 'beforeCreate', 'beforeMount', 'beforeUpdate', 'beforeDestroy'];
    for (const hook of lifecycleHooks) {
      if (content.includes(`${hook}(`)) {
        metadata.lifecycle.push(hook);
      }
    }

    return metadata;
  }

  /**
   * Extract Svelte component metadata
   */
  extractSvelteMetadata(content) {
    const metadata = {
      props: [],
      reactive: [],
      stores: [],
      exports: []
    };

    // Extract props (export let)
    const propMatches = content.matchAll(/export\s+let\s+(\w+)/g);
    for (const match of propMatches) {
      metadata.props.push(match[1]);
    }

    // Extract reactive statements
    const reactiveMatches = content.matchAll(/\$:\s+(\w+)/g);
    for (const match of reactiveMatches) {
      metadata.reactive.push(match[1]);
    }

    // Extract stores
    const storeMatches = content.matchAll(/\$(\w+)/g);
    for (const match of storeMatches) {
      metadata.stores.push(match[1]);
    }

    return metadata;
  }
}

module.exports = FrameworkDetector;
