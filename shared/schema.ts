import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scanHistory = pgTable("scan_history", {
  id: serial("id").primaryKey(),
  address: text("address").notNull(),
  scanDepth: integer("scan_depth").notNull().default(50),
  txCount: integer("tx_count").notNull().default(0),
  derivedCount: integer("derived_count").notNull().default(0),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const derivedIdentities = pgTable("derived_identities", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").references(() => scanHistory.id),
  sourceTxId: text("source_tx_id").notNull(),
  wif: text("wif").notNull(),
  ethAddress: text("eth_address"),
  btcLegacy: text("btc_legacy"),
  btcSegwit: text("btc_segwit"),
  btcBech32: text("btc_bech32"),
  balanceBtc: text("balance_btc").default("0"),
  balanceEth: text("balance_eth").default("0"),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id"),
  logType: text("log_type").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScanHistorySchema = createInsertSchema(scanHistory).omit({
  id: true,
  createdAt: true,
});

export const insertDerivedIdentitySchema = createInsertSchema(derivedIdentities).omit({
  id: true,
  createdAt: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  createdAt: true,
});

export type ScanHistory = typeof scanHistory.$inferSelect;
export type InsertScanHistory = z.infer<typeof insertScanHistorySchema>;

export type DerivedIdentity = typeof derivedIdentities.$inferSelect;
export type InsertDerivedIdentity = z.infer<typeof insertDerivedIdentitySchema>;

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
