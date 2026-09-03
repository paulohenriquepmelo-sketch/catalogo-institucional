import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const departments = sqliteTable(
  'departments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
  },
  (table) => [uniqueIndex('idx_departments_slug').on(table.slug)],
);

export const sections = sqliteTable('sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  departmentId: integer('department_id')
    .notNull()
    .references(() => departments.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sectionId: integer('section_id')
    .notNull()
    .references(() => sections.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
});

export const brands = sqliteTable(
  'brands',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    logoUrl: text('logo_url'),
  },
  (table) => [uniqueIndex('idx_brands_slug').on(table.slug)],
);

export const productsTable = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    department: text('department').notNull(),
    section: text('section').notNull(),
    category: text('category').notNull(),
    segment: text('segment').notNull(),
    brand: text('brand').notNull(),
    image: text('image').notNull(),
    specs: text('specs').notNull().default('[]'),
    details: text('details').notNull().default('{}'),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    published: integer('published', { mode: 'boolean' })
      .notNull()
      .default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_products_code').on(table.code)],
);

export const pageBlocks = sqliteTable('page_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull().default('{}'),
  position: integer('position').notNull(),
  visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
});

export const catalogConfig = sqliteTable('catalog_config', {
  id: integer('id').primaryKey(),
  body: text('body').notNull(),
  revision: integer('revision').notNull().default(1),
});
