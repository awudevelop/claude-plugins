# MockData - FE-First Data Layer Library

> Define your data schema once. Get types, mocks, persistence, and CRUD automatically. Build entire FE flows without BE. Connect to real API when ready with zero code changes.

## Vision

MockData is a **frontend-first data layer library** that inverts the traditional API development workflow. Instead of waiting for backend APIs, frontend developers define their data needs upfront and get:

1. **TypeScript types** - Full type safety from schema
2. **Mock data generation** - Realistic fake data via faker.js
3. **In-memory persistence** - Full CRUD with relationships
4. **API mocking** - MSW handlers auto-generated
5. **OpenAPI spec export** - Share contract with backend team
6. **Seamless production switch** - Connect to real APIs with zero code changes
7. **Compile-time elimination** - Zero mock code in production bundle

## Key Differentiators

| Feature | Kubb | Orval | MirageJS | MSW | **MockData** |
|---------|------|-------|----------|-----|--------------|
| FE-first schema | ❌ | ❌ | ❌ | ❌ | ✅ |
| Auto type generation | ✅ | ✅ | ❌ | ❌ | ✅ |
| Auto mock generation | ✅ | ✅ | ❌ | ❌ | ✅ |
| In-memory persistence | ❌ | ❌ | ✅ | ❌ | ✅ |
| Relationships/joins | ❌ | ❌ | ✅ | ❌ | ✅ |
| Computed fields | ❌ | ❌ | ❌ | ❌ | ✅ |
| OpenAPI export | ❌ | ❌ | ❌ | ❌ | ✅ |
| Compile-time elimination | ❌ | ❌ | ❌ | ❌ | ✅ |
| Pluggable adapters | ❌ | ❌ | ❌ | ❌ | ✅ |
| Middleware system | ❌ | ❌ | ❌ | ❌ | ✅ |

## Quick Example

```typescript
// 1. Define your schema (FE-first, no backend needed)
import { defineData, field, hasOne, hasMany } from '@mockdata/schema';

export const User = defineData('user', {
  id: field.uuid(),
  name: field.person.fullName(),
  email: field.internet.email(),
  profile: hasOne('userProfile', { eager: true }),
  posts: hasMany('post'),

  // Computed fields
  postCount: field.computed({
    mock: () => faker.number.int({ min: 0, max: 100 }),
    resolve: (user, db) => db.post.count({ where: { authorId: user.id } }),
  }),
});

// 2. Use in components (works immediately with mock data)
function UserProfile({ userId }) {
  const { data, loading } = useData(User, {
    id: userId,
    include: ['profile', 'posts'],
  });

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.postCount} posts</p>
    </div>
  );
}

// 3. Export OpenAPI for backend team
// $ npx mockdata generate:openapi --output ./openapi.yaml

// 4. Connect to real API when ready
User.connect({
  endpoint: '/api/users',
  transform: (apiResponse) => ({
    id: apiResponse.user_id,
    name: apiResponse.full_name,
    // ... map fields
  }),
});

// 5. Production build eliminates ALL mock code (99% bundle reduction)
```

## Documentation

### Design Documents

1. [Vision & USP](./design/01-vision-and-usp.md) - Problem statement, market analysis
2. [Architecture](./design/02-architecture.md) - Core architecture overview
3. [Schema DSL](./design/03-schema-dsl.md) - Schema definition language
4. [Resolver System](./design/04-resolver-system.md) - Relations, computed fields, views
5. [Adapters](./design/05-adapters.md) - Pluggable backend adapters
6. [Middleware](./design/06-middleware.md) - Auth, caching, retry, logging
7. [OpenAPI Generation](./design/07-openapi-generation.md) - Swagger/OpenAPI export
8. [Compile Elimination](./design/08-compile-elimination.md) - Production optimization
9. [Implementation Roadmap](./design/09-implementation-roadmap.md) - Development phases

### Source Code

- [`src/schema/`](./src/schema/) - Schema DSL implementation
- [`src/runtime/`](./src/runtime/) - Runtime resolver and handlers
- [`src/adapters/`](./src/adapters/) - Backend adapters (Fetch, Supabase, Firebase, GraphQL)
- [`src/middleware/`](./src/middleware/) - Middleware system
- [`src/generator/`](./src/generator/) - OpenAPI generator
- [`src/build/`](./src/build/) - Babel plugin for compile-time elimination

### Examples

- [Basic Usage](./examples/basic-usage.ts)
- [Supabase Setup](./examples/supabase-setup.ts)
- [Firebase Setup](./examples/firebase-setup.ts)
- [GraphQL Setup](./examples/graphql-setup.ts)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FE SCHEMA                               │
│   defineData('user', { id, name, email, posts, postCount })    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┬───────────────┐
            │               │               │               │
            ▼               ▼               ▼               ▼
     ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
     │  Types   │    │  Mocks   │    │ OpenAPI  │    │ Postman  │
     │  (.ts)   │    │ (MSW+DB) │    │  (yaml)  │    │  (json)  │
     └──────────┘    └──────────┘    └──────────┘    └──────────┘
            │               │
            │      DEV      │      PROD
            │               │
            ▼               ▼
     ┌─────────────────────────────────────────────────────────┐
     │                    useData(User, { id })                │
     └───────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────┐
     │                   MIDDLEWARE CHAIN                      │
     │   [Auth] → [Logger] → [Cache] → [Retry]                │
     └───────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────┐
     │                      ADAPTERS                           │
     │   Fetch | Supabase | Firebase | GraphQL | Custom        │
     └─────────────────────────────────────────────────────────┘
```

## Bundle Size Impact

| Mode | Bundle Size | Contents |
|------|-------------|----------|
| Development | ~500 KB | faker.js, MSW, @mswjs/data, schema, resolvers |
| **Production** | **~3.5 KB** | Minimal runtime only (99.3% reduction) |

## Tech Stack

- **Runtime**: Node.js, TypeScript
- **Mock Data**: faker.js
- **Persistence**: @mswjs/data
- **Network Mocking**: MSW (Mock Service Worker)
- **Build Transform**: Babel plugin
- **React Integration**: @tanstack/react-query

## License

MIT

## Status

🚧 **Design Phase** - This is the initial design document. Implementation pending.
