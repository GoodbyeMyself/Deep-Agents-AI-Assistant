import pg from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { PostgresAgentStore } from "../modules/session/postgres-store.js";

/** Owns a single runner lease, platform migrations, and the official Checkpointer pool. */
export async function createPostgresStorage(databaseUrl: string, modelConfigVersion: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10,
    connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000,
    statement_timeout: 30_000, application_name: "assistant-agent-server" });
  // Never log a database error's payload: it may contain connection details.
  pool.on("error", () => console.error("PostgreSQL pool connection error."));
  const lease = await pool.connect().catch(async (error: unknown) => { await pool.end(); throw error; });
  const store = new PostgresAgentStore(pool, modelConfigVersion);
  const checkpointer = new PostgresSaver(pool, undefined, { schema: "assistant_checkpoints" });
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await lease.query("SELECT pg_advisory_unlock(74102832)").catch(() => undefined);
    lease.release();
    await pool.end();
  }
  try {
    const result = await lease.query<{ locked: boolean }>("SELECT pg_try_advisory_lock(74102832) AS locked");
    if (result.rows[0]?.locked !== true) throw new Error("Another Agent Server owns this database runner lease.");
    // Losing the exclusive lease requires a process restart, never silent concurrent execution.
    lease.on("error", () => {
      console.error("PostgreSQL runner lease lost; shutting down.");
      process.kill(process.pid, "SIGTERM");
    });
    await store.setup();
    await checkpointer.setup();
    await store.recoverAbandonedRuns();
    console.info("PostgreSQL storage and official Checkpointer initialized.");
    return { store, checkpointer, close };
  } catch (error) { await close(); throw error; }
}
