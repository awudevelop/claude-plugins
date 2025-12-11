/**
 * Field type builders for schema definitions
 *
 * Usage:
 *   field.uuid()
 *   field.string().min(1).max(100)
 *   field.person.fullName()
 *   field.internet.email().unique()
 *   field.enum(['admin', 'user']).default('user')
 *   field.computed({ mock: () => 0, resolve: (e, db) => db.count() })
 */

import { faker } from '@faker-js/faker';
import { FieldDefinition, ComputedDefinition } from './types';

// Field builder class for chaining
class FieldBuilder {
  private def: FieldDefinition;

  constructor(type: string, fakerFn?: () => any) {
    this.def = {
      type,
      faker: fakerFn,
    };
  }

  nullable(): this {
    this.def.nullable = true;
    return this;
  }

  unique(message?: string): this {
    this.def.unique = true;
    return this;
  }

  readOnly(): this {
    this.def.readOnly = true;
    return this;
  }

  default(value: any): this {
    this.def.default = value;
    return this;
  }

  min(value: number, message?: string): this {
    this.def.min = value;
    return this;
  }

  max(value: number, message?: string): this {
    this.def.max = value;
    return this;
  }

  pattern(regex: RegExp, message?: string): this {
    this.def.pattern = regex;
    return this;
  }

  length(count: number): this {
    this.def.min = count;
    this.def.max = count;
    return this;
  }

  build(): FieldDefinition {
    return this.def;
  }

  // Allow using the builder directly as a FieldDefinition
  toJSON(): FieldDefinition {
    return this.def;
  }
}

// Computed field builder
interface ComputedConfig {
  mock: () => any;
  resolve: (entity: any, db: any, context: any) => any;
  dependsOn?: string[];
}

class ComputedBuilder {
  private def: ComputedDefinition;

  constructor(config: ComputedConfig) {
    this.def = {
      mock: config.mock,
      resolve: config.resolve,
      dependsOn: config.dependsOn,
    };
  }

  build(): ComputedDefinition {
    return this.def;
  }

  toJSON(): ComputedDefinition {
    return this.def;
  }
}

// Main field object with all type builders
export const field = {
  // Basic types
  uuid: () => new FieldBuilder('uuid', () => faker.string.uuid()),

  string: () => new FieldBuilder('string', () => faker.lorem.word()),

  boolean: () => new FieldBuilder('boolean', () => faker.datatype.boolean()),

  // Number types
  number: {
    int: (options?: { min?: number; max?: number }) =>
      new FieldBuilder('integer', () =>
        faker.number.int({ min: options?.min ?? 0, max: options?.max ?? 1000 })
      ),
    float: (options?: { min?: number; max?: number; precision?: number }) =>
      new FieldBuilder('number', () =>
        faker.number.float({
          min: options?.min ?? 0,
          max: options?.max ?? 1000,
          fractionDigits: options?.precision ?? 2,
        })
      ),
  },

  // Date types
  date: Object.assign(
    () => new FieldBuilder('date', () => faker.date.anytime()),
    {
      past: () => new FieldBuilder('date', () => faker.date.past()),
      future: () => new FieldBuilder('date', () => faker.date.future()),
      recent: () => new FieldBuilder('date', () => faker.date.recent()),
      between: (options: { from: string | Date; to: string | Date }) =>
        new FieldBuilder('date', () =>
          faker.date.between({ from: options.from, to: options.to })
        ),
    }
  ),

  // Enum
  enum: (values: string[]) => {
    const builder = new FieldBuilder('enum', () =>
      faker.helpers.arrayElement(values)
    );
    (builder as any).def.values = values;
    return builder;
  },

  // Array
  array: (itemType: FieldBuilder) => {
    const builder = new FieldBuilder('array', () => {
      const count = faker.number.int({ min: 1, max: 5 });
      const itemDef = itemType.build();
      return Array.from({ length: count }, () =>
        itemDef.faker ? itemDef.faker() : null
      );
    });
    (builder as any).def.itemType = itemType.build();
    return builder;
  },

  // Object (nested)
  object: (schema: Record<string, FieldBuilder>) => {
    const builder = new FieldBuilder('object', () => {
      const result: Record<string, any> = {};
      for (const [key, fieldBuilder] of Object.entries(schema)) {
        const fieldDef = fieldBuilder.build();
        result[key] = fieldDef.faker ? fieldDef.faker() : null;
      }
      return result;
    });
    return builder;
  },

  // Reference to another entity
  ref: (entityName: string) =>
    new FieldBuilder('ref', () => faker.string.uuid()),

  // Union type
  union: (types: FieldBuilder[]) => {
    const builder = new FieldBuilder('union', () => {
      const selected = faker.helpers.arrayElement(types);
      const def = selected.build();
      return def.faker ? def.faker() : null;
    });
    return builder;
  },

  // Literal value
  literal: (value: any) =>
    new FieldBuilder('literal', () => value),

  // Computed field
  computed: (config: ComputedConfig) => new ComputedBuilder(config),

  // Person types
  person: {
    fullName: () => new FieldBuilder('string', () => faker.person.fullName()),
    firstName: () => new FieldBuilder('string', () => faker.person.firstName()),
    lastName: () => new FieldBuilder('string', () => faker.person.lastName()),
    jobTitle: () => new FieldBuilder('string', () => faker.person.jobTitle()),
    bio: () => new FieldBuilder('string', () => faker.person.bio()),
  },

  // Internet types
  internet: {
    email: () => new FieldBuilder('email', () => faker.internet.email()),
    url: () => new FieldBuilder('url', () => faker.internet.url()),
    avatar: () => new FieldBuilder('url', () => faker.image.avatar()),
    username: () => new FieldBuilder('string', () => faker.internet.username()),
    password: () => new FieldBuilder('string', () => faker.internet.password()),
  },

  // Image types
  image: {
    avatar: () => new FieldBuilder('url', () => faker.image.avatar()),
    url: (options?: { width?: number; height?: number }) =>
      new FieldBuilder('url', () =>
        faker.image.url({ width: options?.width, height: options?.height })
      ),
  },

  // Lorem types
  lorem: {
    word: () => new FieldBuilder('string', () => faker.lorem.word()),
    words: (count?: number) =>
      new FieldBuilder('string', () => faker.lorem.words(count)),
    sentence: () => new FieldBuilder('string', () => faker.lorem.sentence()),
    paragraph: () => new FieldBuilder('string', () => faker.lorem.paragraph()),
    paragraphs: (count?: number) =>
      new FieldBuilder('string', () => faker.lorem.paragraphs(count)),
  },

  // Location types
  location: {
    city: () => new FieldBuilder('string', () => faker.location.city()),
    country: () => new FieldBuilder('string', () => faker.location.country()),
    streetAddress: () =>
      new FieldBuilder('string', () => faker.location.streetAddress()),
    zipCode: () => new FieldBuilder('string', () => faker.location.zipCode()),
    latitude: () => new FieldBuilder('number', () => faker.location.latitude()),
    longitude: () =>
      new FieldBuilder('number', () => faker.location.longitude()),
  },

  // Phone types
  phone: {
    number: () => new FieldBuilder('string', () => faker.phone.number()),
  },

  // Commerce types
  commerce: {
    productName: () =>
      new FieldBuilder('string', () => faker.commerce.productName()),
    price: () =>
      new FieldBuilder('number', () => parseFloat(faker.commerce.price())),
    department: () =>
      new FieldBuilder('string', () => faker.commerce.department()),
  },

  // Company types
  company: {
    name: () => new FieldBuilder('string', () => faker.company.name()),
    catchPhrase: () =>
      new FieldBuilder('string', () => faker.company.catchPhrase()),
  },
};
