/** Platform-owned tables. Official LangGraph tables live in a separate schema. */
export const POSTGRES_SCHEMA_V1 = `
CREATE SCHEMA IF NOT EXISTS assistant;
CREATE TABLE IF NOT EXISTS assistant.schema_migrations (
  version integer PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assistant.sessions (
  id uuid PRIMARY KEY, owner_id text NOT NULL, tenant_id text NOT NULL,
  record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_owner_idx ON assistant.sessions(tenant_id, owner_id, created_at);
CREATE TABLE IF NOT EXISTS assistant.context_snapshots (
  id uuid PRIMARY KEY, owner_id text NOT NULL, tenant_id text NOT NULL,
  record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assistant.runs (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES assistant.sessions(id),
  owner_id text NOT NULL, tenant_id text NOT NULL,
  request_key text NOT NULL, status text NOT NULL CHECK
    (status IN ('queued','running','interrupted','completed','failed','cancelled')),
  record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(session_id, request_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS runs_one_active_idx ON assistant.runs(session_id)
  WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS runs_owner_idx ON assistant.runs(tenant_id, owner_id, session_id);
CREATE TABLE IF NOT EXISTS assistant.messages (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES assistant.sessions(id),
  run_id uuid NOT NULL REFERENCES assistant.runs(id), record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_session_idx ON assistant.messages(session_id, created_at, id);
CREATE TABLE IF NOT EXISTS assistant.events (
  event_id text PRIMARY KEY, run_id uuid NOT NULL REFERENCES assistant.runs(id),
  sequence integer NOT NULL CHECK(sequence > 0), record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, sequence)
);
CREATE TABLE IF NOT EXISTS assistant.interrupts (
  id text NOT NULL, run_id uuid NOT NULL REFERENCES assistant.runs(id),
  session_id uuid NOT NULL REFERENCES assistant.sessions(id), status text NOT NULL,
  record jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(run_id, id)
);
CREATE INDEX IF NOT EXISTS interrupts_session_idx ON assistant.interrupts(session_id, status);
CREATE TABLE IF NOT EXISTS assistant.evidence (
  reference_id text PRIMARY KEY, run_id uuid NOT NULL REFERENCES assistant.runs(id),
  owner_id text NOT NULL, tenant_id text NOT NULL, record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assistant.audit_events (
  id uuid PRIMARY KEY, owner_id text NOT NULL, tenant_id text NOT NULL,
  action text NOT NULL, resource_id text NOT NULL, outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_resource_idx ON assistant.audit_events(tenant_id, resource_id, created_at);
INSERT INTO assistant.schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
`;
