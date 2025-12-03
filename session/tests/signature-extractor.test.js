/**
 * Signature Extractor Test Suite
 * Tests extraction of function signatures across JavaScript and TypeScript variants
 */

const {
  SignatureExtractor,
  parseJavaScriptFunction,
  parseTypeScriptFunction,
  extractClassMethods,
  extractTypeDefinitions
} = require('../cli/lib/extractors/signature-extractor');

describe('SignatureExtractor', () => {
  let extractor;

  beforeEach(() => {
    extractor = new SignatureExtractor();
  });

  describe('JavaScript Function Extraction', () => {
    test('extracts regular function declaration', () => {
      const source = `
        function calculateSum(a, b) {
          return a + b;
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('calculateSum');
      expect(result.functions[0].kind).toBe('function');
      expect(result.functions[0].parameters).toHaveLength(2);
      expect(result.functions[0].parameters[0].name).toBe('a');
      expect(result.functions[0].parameters[1].name).toBe('b');
    });

    test('extracts async function', () => {
      const source = `
        async function fetchData(url, options) {
          return await fetch(url, options);
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('fetchData');
      expect(result.functions[0].kind).toBe('async');
    });

    test('extracts generator function', () => {
      const source = `
        function* numberGenerator(max) {
          for (let i = 0; i < max; i++) yield i;
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('numberGenerator');
      expect(result.functions[0].kind).toBe('generator');
    });

    test('extracts arrow function assigned to const', () => {
      const source = `
        const multiply = (x, y) => x * y;
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('multiply');
      expect(result.functions[0].kind).toBe('arrow');
    });

    test('extracts async arrow function', () => {
      const source = `
        const loadUser = async (id) => {
          const user = await db.findUser(id);
          return user;
        };
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('loadUser');
      expect(result.functions[0].kind).toBe('async');
    });

    test('extracts exported function', () => {
      const source = `
        export function publicApi(data) {
          return process(data);
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isExported).toBe(true);
    });

    test('extracts default exported function', () => {
      const source = `
        export default function mainHandler(req, res) {
          res.send('ok');
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isExported).toBe(true);
      expect(result.functions[0].isDefault).toBe(true);
    });

    test('extracts function with default parameters', () => {
      const source = `
        function greet(name, greeting = 'Hello') {
          return greeting + ', ' + name;
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions[0].parameters).toHaveLength(2);
      expect(result.functions[0].parameters[1].hasDefault).toBe(true);
      expect(result.functions[0].parameters[1].defaultValue).toBe("'Hello'");
    });

    test('extracts function with rest parameters', () => {
      const source = `
        function logAll(prefix, ...messages) {
          messages.forEach(m => console.log(prefix + m));
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions[0].parameters).toHaveLength(2);
      expect(result.functions[0].parameters[1].isRest).toBe(true);
    });

    test('extracts function with destructuring parameter', () => {
      const source = `
        function processUser({ name, email, age = 18 }) {
          return { name, email, age };
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions[0].parameters).toHaveLength(1);
      expect(result.functions[0].parameters[0].pattern).toBe('object');
    });
  });

  describe('JavaScript Class Extraction', () => {
    test('extracts class with methods', () => {
      const source = `
        class UserService {
          constructor(db) {
            this.db = db;
          }

          findById(id) {
            return this.db.find(id);
          }

          async updateUser(id, data) {
            await this.db.update(id, data);
          }
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0].name).toBe('UserService');
      expect(result.classes[0].constructor).toBeTruthy();
      expect(result.classes[0].methods).toHaveLength(2);
      expect(result.classes[0].methods[0].name).toBe('findById');
      expect(result.classes[0].methods[1].name).toBe('updateUser');
      expect(result.classes[0].methods[1].isAsync).toBe(true);
    });

    test('extracts class with getters and setters', () => {
      const source = `
        class Person {
          get fullName() {
            return this.firstName + ' ' + this.lastName;
          }

          set fullName(value) {
            const parts = value.split(' ');
            this.firstName = parts[0];
            this.lastName = parts[1];
          }
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.classes[0].methods).toHaveLength(2);
      expect(result.classes[0].methods[0].kind).toBe('get');
      expect(result.classes[0].methods[1].kind).toBe('set');
    });

    test('extracts class extending another class', () => {
      const source = `
        class AdminService extends UserService {
          deleteUser(id) {
            return this.db.delete(id);
          }
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.classes[0].extends).toBe('UserService');
    });

    test('extracts exported class', () => {
      const source = `
        export class DataHandler {
          process(data) {
            return data;
          }
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.classes[0].isExported).toBe(true);
    });
  });

  describe('TypeScript Function Extraction', () => {
    test('extracts function with type annotations', () => {
      const source = `
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].parameters[0].type.raw).toBe('number');
      expect(result.functions[0].returnType.raw).toBe('number');
    });

    test('extracts generic function', () => {
      const source = `
        function identity<T>(value: T): T {
          return value;
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.functions[0].generics).toHaveLength(1);
      expect(result.functions[0].generics[0].name).toBe('T');
    });

    test('extracts function with complex types', () => {
      const source = `
        async function fetchUsers(ids: string[]): Promise<User[]> {
          return db.find(ids);
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.functions[0].parameters[0].type.kind).toBe('array');
      expect(result.functions[0].returnType.kind).toBe('generic');
      expect(result.functions[0].returnType.name).toBe('Promise');
    });

    test('extracts function with optional parameters', () => {
      const source = `
        function greet(name: string, title?: string): string {
          return title ? title + ' ' + name : name;
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.functions[0].parameters[1].isOptional).toBe(true);
    });

    test('extracts arrow function with type annotation', () => {
      const source = `
        const multiply: (x: number, y: number) => number = (x, y) => x * y;
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('multiply');
    });
  });

  describe('TypeScript Interface Extraction', () => {
    test('extracts simple interface', () => {
      const source = `
        interface User {
          id: string;
          name: string;
          email: string;
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.interfaces).toHaveLength(1);
      expect(result.interfaces[0].name).toBe('User');
      expect(result.interfaces[0].properties).toHaveLength(3);
    });

    test('extracts interface with optional properties', () => {
      const source = `
        interface Config {
          required: string;
          optional?: number;
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.interfaces[0].properties[0].isOptional).toBe(false);
      expect(result.interfaces[0].properties[1].isOptional).toBe(true);
    });

    test('extracts interface with methods', () => {
      const source = `
        interface Repository<T> {
          find(id: string): T;
          save(item: T): void;
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.interfaces[0].generics).toHaveLength(1);
      expect(result.interfaces[0].methods).toHaveLength(2);
    });

    test('extracts interface extending another', () => {
      const source = `
        interface AdminUser extends User {
          permissions: string[];
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.interfaces[0].extends).toContain('User');
    });

    test('extracts exported interface', () => {
      const source = `
        export interface ApiResponse {
          data: any;
          status: number;
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.interfaces[0].isExported).toBe(true);
    });
  });

  describe('TypeScript Type Alias Extraction', () => {
    test('extracts simple type alias', () => {
      const source = `
        type ID = string;
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.typeAliases).toHaveLength(1);
      expect(result.typeAliases[0].name).toBe('ID');
      expect(result.typeAliases[0].type.kind).toBe('primitive');
    });

    test('extracts union type alias', () => {
      const source = `
        type Status = 'pending' | 'active' | 'completed';
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.typeAliases[0].type.kind).toBe('union');
    });

    test('extracts generic type alias', () => {
      const source = `
        type Result<T, E> = { success: true; data: T } | { success: false; error: E };
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.typeAliases[0].generics).toHaveLength(2);
    });
  });

  describe('TypeScript Enum Extraction', () => {
    test('extracts numeric enum', () => {
      const source = `
        enum Direction {
          Up,
          Down,
          Left,
          Right
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.enums).toHaveLength(1);
      expect(result.enums[0].name).toBe('Direction');
      expect(result.enums[0].members).toHaveLength(4);
    });

    test('extracts string enum', () => {
      const source = `
        enum Status {
          Pending = 'PENDING',
          Active = 'ACTIVE',
          Done = 'DONE'
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.enums[0].members[0].value).toBe('PENDING');
    });

    test('extracts const enum', () => {
      const source = `
        const enum HttpStatus {
          OK = 200,
          NotFound = 404
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.enums[0].isConst).toBe(true);
    });
  });

  describe('JSDoc Extraction', () => {
    test('extracts JSDoc description', () => {
      const source = `
        /**
         * Calculates the sum of two numbers
         */
        function add(a, b) {
          return a + b;
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions[0].jsdoc).toBeTruthy();
      expect(result.functions[0].jsdoc.description).toContain('sum of two numbers');
    });

    test('extracts JSDoc params', () => {
      const source = `
        /**
         * Greets a user
         * @param {string} name - The user's name
         * @param {string} [title] - Optional title
         * @returns {string} The greeting
         */
        function greet(name, title) {
          return title ? title + ' ' + name : name;
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions[0].jsdoc.params).toHaveLength(2);
      expect(result.functions[0].jsdoc.params[0].name).toBe('name');
      expect(result.functions[0].jsdoc.params[0].type).toBe('string');
      expect(result.functions[0].jsdoc.params[1].optional).toBe(true);
      expect(result.functions[0].jsdoc.returns).toBeTruthy();
    });
  });

  describe('TypeScript Class with Visibility Modifiers', () => {
    test('extracts private methods', () => {
      const source = `
        class Service {
          private secretMethod(): void {
            // internal
          }

          public publicMethod(): void {
            this.secretMethod();
          }
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.classes[0].methods.some(m => m.visibility === 'private')).toBe(true);
      expect(result.classes[0].methods.some(m => m.visibility === 'public')).toBe(true);
    });

    test('extracts static methods', () => {
      const source = `
        class Utils {
          static formatDate(date: Date): string {
            return date.toISOString();
          }
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.classes[0].methods[0].isStatic).toBe(true);
    });

    test('extracts abstract class and methods', () => {
      const source = `
        abstract class BaseRepository<T> {
          abstract find(id: string): T;

          log(message: string): void {
            console.log(message);
          }
        }
      `;
      const result = extractor.parseTypeScriptFile(source, 'test.ts');

      expect(result.classes[0].isAbstract).toBe(true);
    });
  });

  describe('Convenience Functions', () => {
    test('parseJavaScriptFunction convenience function works', () => {
      const source = `function test() { return 1; }`;
      const result = parseJavaScriptFunction(source, 'test.js');

      expect(result.functions).toHaveLength(1);
    });

    test('parseTypeScriptFunction convenience function works', () => {
      const source = `function test(): number { return 1; }`;
      const result = parseTypeScriptFunction(source, 'test.ts');

      expect(result.functions).toHaveLength(1);
    });

    test('extractClassMethods convenience function works', () => {
      const source = `
        class MyClass {
          myMethod() { return 1; }
        }
      `;
      const result = extractClassMethods(source, 'MyClass', 'test.js');

      expect(result).toBeTruthy();
      expect(result.name).toBe('MyClass');
      expect(result.methods).toHaveLength(1);
    });

    test('extractTypeDefinitions convenience function works', () => {
      const source = `
        interface User { id: string; }
        type ID = string;
        enum Status { Active }
      `;
      const result = extractTypeDefinitions(source, 'test.ts');

      expect(result.interfaces).toHaveLength(1);
      expect(result.typeAliases).toHaveLength(1);
      expect(result.enums).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    test('handles nested functions', () => {
      const source = `
        function outer() {
          function inner() {
            return 1;
          }
          return inner();
        }
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      // Should capture both outer and inner functions
      expect(result.functions.length).toBeGreaterThanOrEqual(1);
    });

    test('handles empty source', () => {
      const source = '';
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(0);
      expect(result.classes).toHaveLength(0);
    });

    test('handles source with only comments', () => {
      const source = `
        // This is a comment
        /* Multi-line
           comment */
      `;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(0);
    });

    test('handles minified code', () => {
      const source = `function a(b,c){return b+c}class D{e(){return 1}}`;
      const result = extractor.parseJavaScriptFile(source, 'test.js');

      expect(result.functions).toHaveLength(1);
      expect(result.classes).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    test('tracks extraction statistics', () => {
      const source = `
        async function asyncFunc() {}
        const arrow = () => {};
        class MyClass {
          private privateMethod() {}
          public publicMethod() {}
        }
      `;
      extractor.parseJavaScriptFile(source, 'test.js');
      const stats = extractor.getStatistics();

      expect(stats.filesProcessed).toBe(1);
      expect(stats.totalFunctions).toBeGreaterThan(0);
      expect(stats.totalClasses).toBe(1);
    });

    test('resets statistics', () => {
      extractor.parseJavaScriptFile('function a() {}', 'test.js');
      extractor.resetStatistics();
      const stats = extractor.getStatistics();

      expect(stats.filesProcessed).toBe(0);
      expect(stats.totalFunctions).toBe(0);
    });
  });
});
