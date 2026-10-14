-- PostgreSQL reference migration for the M2 deployment store.
-- Runtime tests use InMemoryAgentStore; production must bind the same repository contract to these tables.
CREATE TABLE assistant_sessions (
  id uuid PRIMARY KEY, owner_id text NOT NULL, tenant_id text NOT NULL, thread_id uuid NOT NULL UNIQUE,
  title text NOT NULL, mode text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL
);
CREATE INDEX assistant_sessions_owner_created_idx ON assistant_sessions (tenant_id, owner_id, created_at DESC);

CREATE TABLE context_snapshots (
  id uuid PRIMARY KEY, owner_id text NOT NULL, tenant_id text NOT NULL, version integer NOT NULL,
  mode text NOT NULL, normalized_context jsonb NOT NULL, captured_at timestamptz NOT NULL
);
CREATE INDEX context_snapshots_owner_idx ON context_snapshots (tenant_id, owner_id, captured_at DESC);

CREATE TABLE assistant_runs (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES assistant_sessions(id), owner_id text NOT NULL,
  tenant_id text NOT NULL, context_snapshot_id uuid NOT NULL REFERENCES context_snapshots(id),
  client_request_id text NOT NULL, status text NOT NULL, model_config_version text NOT NULL,
  created_at timestamptz NOT NULL, UNIQUE (session_id, client_request_id)
);
CREATE UNIQUE INDEX assistant_runs_one_active_idx ON assistant_runs (session_id) WHERE status IN ('queued', 'running');

CREATE TABLE assistant_messages (
  id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES assistant_sessions(id),
  run_id uuid REFERENCES assistant_runs(id), role text NOT NULL, content text NOT NULL,
  evidence_refs jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL
);
CREATE INDEX assistant_messages_session_idx ON assistant_messages (session_id, created_at);

CREATE TABLE run_events (
  run_id uuid NOT NULL REFERENCES assistant_runs(id), sequence integer NOT NULL, event_id text NOT NULL UNIQUE,
  event_type text NOT NULL, payload jsonb NOT NULL, created_at timestamptz NOT NULL,
  PRIMARY KEY (run_id, sequence)
);

CREATE TABLE evidence_records (
  reference_id text PRIMARY KEY, run_id uuid NOT NULL REFERENCES assistant_runs(id), owner_id text NOT NULL,
  tenant_id text NOT NULL, object_id text, evidence jsonb NOT NULL, created_at timestamptz NOT NULL
);
CREATE INDEX evidence_records_owner_idx ON evidence_records (tenant_id, owner_id, created_at DESC);

CREATE TABLE audit_records (
  id bigserial PRIMARY KEY, run_id uuid, session_id uuid, owner_id text NOT NULL, tenant_id text,
  capability_id text NOT NULL, outcome text NOT NULL, evidence_refs jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_records_run_idx ON audit_records (run_id, created_at);

-- Soft-deleted sessions and their dependent business records are purged by a deployment-owned,
-- parameterized retention job after the configured retention period. Checkpoint blobs use a separate
-- official LangGraph saver and are never exposed through these tables or API responses.
