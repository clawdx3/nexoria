-- Enable extensions used by Nexoria. Runs once on a fresh postgres data volume.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
