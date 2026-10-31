import postgres from 'postgres'
import { config } from './index.js'
const sqlClient = postgres(config.databaseUrl)
export default sqlClient