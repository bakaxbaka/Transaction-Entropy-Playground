import { 
  scanHistory, derivedIdentities, systemLogs,
  type ScanHistory, type InsertScanHistory,
  type DerivedIdentity, type InsertDerivedIdentity,
  type SystemLog, type InsertSystemLog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  createScan(scan: InsertScanHistory): Promise<ScanHistory>;
  getScan(id: number): Promise<ScanHistory | undefined>;
  getRecentScans(limit?: number): Promise<ScanHistory[]>;
  updateScan(id: number, data: Partial<InsertScanHistory>): Promise<ScanHistory | undefined>;
  
  createDerivedIdentity(identity: InsertDerivedIdentity): Promise<DerivedIdentity>;
  createDerivedIdentities(identities: InsertDerivedIdentity[]): Promise<DerivedIdentity[]>;
  getDerivedIdentitiesByScan(scanId: number): Promise<DerivedIdentity[]>;
  updateDerivedIdentityBalance(id: number, btc: string, eth: string): Promise<void>;
  
  createLog(log: InsertSystemLog): Promise<SystemLog>;
  getLogsByScan(scanId: number): Promise<SystemLog[]>;
  getRecentLogs(limit?: number): Promise<SystemLog[]>;
}

export class DatabaseStorage implements IStorage {
  async createScan(scan: InsertScanHistory): Promise<ScanHistory> {
    const [result] = await db.insert(scanHistory).values(scan).returning();
    return result;
  }

  async getScan(id: number): Promise<ScanHistory | undefined> {
    const [result] = await db.select().from(scanHistory).where(eq(scanHistory.id, id));
    return result;
  }

  async getRecentScans(limit = 10): Promise<ScanHistory[]> {
    return db.select().from(scanHistory).orderBy(desc(scanHistory.createdAt)).limit(limit);
  }

  async updateScan(id: number, data: Partial<InsertScanHistory>): Promise<ScanHistory | undefined> {
    const [result] = await db.update(scanHistory).set(data).where(eq(scanHistory.id, id)).returning();
    return result;
  }

  async createDerivedIdentity(identity: InsertDerivedIdentity): Promise<DerivedIdentity> {
    const [result] = await db.insert(derivedIdentities).values(identity).returning();
    return result;
  }

  async createDerivedIdentities(identities: InsertDerivedIdentity[]): Promise<DerivedIdentity[]> {
    if (identities.length === 0) return [];
    return db.insert(derivedIdentities).values(identities).returning();
  }

  async getDerivedIdentitiesByScan(scanId: number): Promise<DerivedIdentity[]> {
    return db.select().from(derivedIdentities).where(eq(derivedIdentities.scanId, scanId));
  }

  async updateDerivedIdentityBalance(id: number, btc: string, eth: string): Promise<void> {
    await db.update(derivedIdentities)
      .set({ balanceBtc: btc, balanceEth: eth, lastChecked: new Date() })
      .where(eq(derivedIdentities.id, id));
  }

  async createLog(log: InsertSystemLog): Promise<SystemLog> {
    const [result] = await db.insert(systemLogs).values(log).returning();
    return result;
  }

  async getLogsByScan(scanId: number): Promise<SystemLog[]> {
    return db.select().from(systemLogs).where(eq(systemLogs.scanId, scanId)).orderBy(desc(systemLogs.createdAt));
  }

  async getRecentLogs(limit = 100): Promise<SystemLog[]> {
    return db.select().from(systemLogs).orderBy(desc(systemLogs.createdAt)).limit(limit);
  }
}

export const storage = new DatabaseStorage();
