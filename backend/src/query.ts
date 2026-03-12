import { initializeDatabase, getDb } from './services/database.service.js';

const sql = process.argv[2];
if (!sql) {
  console.error('Usage: npx tsx src/query.ts "SELECT ..."');
  process.exit(1);
}

await initializeDatabase();
const db = await getDb();
const { rows } = await db.query(sql);
console.table(rows);
process.exit(0);
