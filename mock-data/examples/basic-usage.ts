/**
 * Basic Usage Example
 *
 * This example demonstrates the core features of MockData:
 * - Schema definition
 * - Relations
 * - Computed fields
 * - Views
 * - Usage in React components
 */

import { defineData, defineView, field, hasOne, hasMany, belongsTo, embed, pick } from '../src/schema';
import { faker } from '@faker-js/faker';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * User Profile entity
 */
export const UserProfile = defineData('userProfile', {
  id: field.uuid(),
  userId: field.uuid(),
  bio: field.lorem.paragraph(),
  avatar: field.image.avatar(),
  website: field.internet.url().nullable(),
  location: field.location.city(),
  createdAt: field.date.past().readOnly(),
});

/**
 * Post entity
 */
export const Post = defineData('post', {
  id: field.uuid(),
  authorId: field.uuid(),
  title: field.lorem.sentence(),
  body: field.lorem.paragraphs(3),
  published: field.boolean().default(false),
  viewCount: field.number.int({ min: 0, max: 10000 }).default(0),
  tags: field.array(field.string()).min(0).max(5),
  createdAt: field.date.past().readOnly(),
  updatedAt: field.date.recent().readOnly(),

  // Relation: Post belongs to User
  author: belongsTo('user', { foreignKey: 'authorId', eager: true }),
});

/**
 * User entity
 */
export const User = defineData('user', {
  id: field.uuid(),
  name: field.person.fullName(),
  email: field.internet.email().unique(),
  role: field.enum(['admin', 'user', 'guest']).default('user'),
  active: field.boolean().default(true),
  createdAt: field.date.past().readOnly(),

  // Relations
  profile: hasOne('userProfile', { foreignKey: 'userId', eager: true }),
  posts: hasMany('post', { foreignKey: 'authorId', orderBy: { createdAt: 'desc' } }),

  // Computed: Count of posts
  postCount: field.computed({
    mock: () => faker.number.int({ min: 0, max: 50 }),
    resolve: (user, db) => db.post.count({
      where: { authorId: { equals: user.id } }
    }),
  }),

  // Computed: Total views across all posts
  totalViews: field.computed({
    mock: () => faker.number.int({ min: 0, max: 50000 }),
    resolve: (user, db) => {
      const posts = db.post.findMany({
        where: { authorId: { equals: user.id } }
      });
      return posts.reduce((sum: number, p: any) => sum + (p.viewCount || 0), 0);
    },
  }),
}, {
  api: {
    basePath: '/api/users',
    pagination: { style: 'offset', defaultLimit: 20, maxLimit: 100 },
    relationships: {
      posts: { endpoint: true },
    },
  },
});

// ============================================================================
// VIEW DEFINITIONS
// ============================================================================

/**
 * User Full View - Aggregated user data
 */
export const UserFullView = defineView('user-full', {
  // Pick fields from User
  ...pick(User, ['id', 'name', 'email', 'role', 'createdAt']),

  // Embed profile
  profile: embed(UserProfile),

  // Embed recent posts (limited)
  recentPosts: embed(Post, {
    limit: 5,
    orderBy: { createdAt: 'desc' },
  }),

  // Aggregated stats
  stats: {
    postCount: field.computed({
      mock: () => faker.number.int({ min: 0, max: 50 }),
      resolve: (_, db, ctx) => db.post.count({
        where: { authorId: { equals: ctx.params.id } }
      }),
    }),
    totalViews: field.computed({
      mock: () => faker.number.int({ min: 0, max: 50000 }),
      resolve: (data: any) => {
        return data.recentPosts?.reduce(
          (sum: number, p: any) => sum + (p.viewCount || 0),
          0
        ) ?? 0;
      },
    }),
  },
}, {
  endpoint: '/api/users/:id/full',
  params: ['id'],
});

// ============================================================================
// USAGE IN REACT COMPONENTS (Pseudocode)
// ============================================================================

/*
import { useData, useMutate, useView } from '@mockdata/react';

// List users
function UserList() {
  const { data, loading, error } = useData(User, {
    limit: 20,
    orderBy: { createdAt: 'desc' },
  });

  if (loading) return <Spinner />;
  if (error) return <Error error={error} />;

  return (
    <ul>
      {data.map(user => (
        <li key={user.id}>{user.name} ({user.postCount} posts)</li>
      ))}
    </ul>
  );
}

// Single user with relations
function UserProfile({ userId }) {
  const { data: user } = useData(User, {
    id: userId,
    include: ['profile', 'posts'],
  });

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.profile?.bio}</p>
      <p>{user.postCount} posts, {user.totalViews} total views</p>
    </div>
  );
}

// User full view
function UserFullProfile({ userId }) {
  const { data } = useView(UserFullView, { id: userId });

  return (
    <div>
      <h1>{data.name}</h1>
      <p>{data.profile?.bio}</p>
      <div>
        <span>{data.stats.postCount} posts</span>
        <span>{data.stats.totalViews} views</span>
      </div>
      <h2>Recent Posts</h2>
      {data.recentPosts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

// Create user
function CreateUserForm() {
  const { create, isLoading } = useMutate(User);

  const handleSubmit = async (formData) => {
    const user = await create.mutateAsync(formData);
    console.log('Created user:', user);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name" placeholder="Name" />
      <input name="email" placeholder="Email" />
      <button disabled={isLoading}>Create</button>
    </form>
  );
}
*/

// ============================================================================
// EXPORT SCHEMAS FOR TESTING
// ============================================================================

export const schemas = {
  User,
  UserProfile,
  Post,
  UserFullView,
};
