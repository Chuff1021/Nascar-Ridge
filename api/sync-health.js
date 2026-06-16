import { neon } from '@neondatabase/serverless'

const DB_ENV_NAMES = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'NEON_DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
  'POSTGRES_URL_NO_SSL',
  'NEON_POSTGRES_URL',
]

function presentEnvNames() {
  return DB_ENV_NAMES.filter((name) => Boolean(process.env[name]))
}

export default async function handler(_request, response) {
  const found = presentEnvNames()
  const dbUrl = found.length > 0 ? process.env[found[0]] : undefined
  let databaseReachable = false
  let databaseError

  if (dbUrl) {
    try {
      const sql = neon(dbUrl)
      await sql`SELECT 1 AS ok`
      databaseReachable = true
    } catch (error) {
      databaseError = error instanceof Error ? error.message : 'Unknown database error'
    }
  }

  response.setHeader('Cache-Control', 'no-store')
  response.status(200).json({
    vercelEnv: process.env.VERCEL_ENV ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    checkedDatabaseEnvNames: DB_ENV_NAMES,
    foundDatabaseEnvNames: found,
    selectedDatabaseEnvName: found[0] ?? null,
    backend: databaseReachable ? 'neon' : 'jsonblob',
    databaseReachable,
    databaseError,
  })
}
