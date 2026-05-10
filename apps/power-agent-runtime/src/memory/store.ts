import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';

export interface MemoryEntry {
  id: string;
  workspaceId: string;
  taskId?: string;
  role: string;
  content: string;
  timestamp: Date;
  embedding?: number[];
}

export class MemoryStore {
  private db: any;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.env.NEXORIA_DATA_DIR || './data', 'memory.sqlite');
  }

  async init(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        workspaceId TEXT NOT NULL,
        taskId TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        embedding TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_workspace ON memories(workspaceId);
      CREATE INDEX IF NOT EXISTS idx_task ON memories(taskId);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON memories(timestamp);
    `);

    console.log(`[memory] initialized at ${this.dbPath}`);
  }

  async add(workspaceId: string, entry: Omit<MemoryEntry, 'id' | 'workspaceId'>): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    await this.db.run(
      `INSERT INTO memories (id, workspaceId, taskId, role, content, timestamp, embedding)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      workspaceId,
      entry.taskId || null,
      entry.role,
      entry.content,
      entry.timestamp.toISOString(),
      entry.embedding ? JSON.stringify(entry.embedding) : null
    );

    return id;
  }

  async getRecent(workspaceId: string, limit = 50): Promise<MemoryEntry[]> {
    const rows = await this.db.all(
      `SELECT * FROM memories WHERE workspaceId = ? ORDER BY timestamp DESC LIMIT ?`,
      workspaceId,
      limit
    );

    return rows.map(this.rowToEntry);
  }

  async getByTask(taskId: string): Promise<MemoryEntry[]> {
    const rows = await this.db.all(
      `SELECT * FROM memories WHERE taskId = ? ORDER BY timestamp ASC`,
      taskId
    );

    return rows.map(this.rowToEntry);
  }

  async search(workspaceId: string, query: string, limit = 10): Promise<MemoryEntry[]> {
    // Simple keyword search for now
    const rows = await this.db.all(
      `SELECT * FROM memories 
       WHERE workspaceId = ? AND content LIKE ? 
       ORDER BY timestamp DESC LIMIT ?`,
      workspaceId,
      `%${query}%`,
      limit
    );

    return rows.map(this.rowToEntry);
  }

  async deleteOlderThan(workspaceId: string, days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.db.run(
      `DELETE FROM memories WHERE workspaceId = ? AND timestamp < ?`,
      workspaceId,
      cutoff.toISOString()
    );

    return result.changes || 0;
  }

  private rowToEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      taskId: row.taskId,
      role: row.role,
      content: row.content,
      timestamp: new Date(row.timestamp),
      embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
    };
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}
