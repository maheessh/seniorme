// Runs before any test file's imports — must set DATABASE_URL before @ccc/db's prisma client
// is constructed (it reads process.env.DATABASE_URL once, at module load, via a module-level
// `export const prisma = createClient()`). Points at a dedicated ccc_test database (created and
// migrated separately — see README's "Running integration tests" section) so integration tests
// never touch real data.
process.env.DATABASE_URL = "postgresql://ccc:ccc@localhost:5432/ccc_test?schema=public";
