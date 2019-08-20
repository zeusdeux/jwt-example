import { Client } from 'faunadb'

let dbClient: Client
export function getDBClient(): Client {
  dbClient = dbClient || new Client({ secret: process.env.JWT_EXAMPLE_DB_KEY! })
  return dbClient
}
