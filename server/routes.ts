import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { deriveSyntheticIdentity, deriveBatch } from "./services/crypto";
import { fetchAddressData, fetchBtcBalance, fetchEthBalance, fetchMempool, fetchBlock } from "./services/blockchain";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/btc/address/:addr", async (req, res) => {
    try {
      const { addr } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;

      const data = await fetchAddressData(addr, limit);

      const scan = await storage.createScan({
        address: addr,
        scanDepth: limit,
        txCount: data.txs.length,
        derivedCount: 0,
        status: "completed"
      });

      await storage.createLog({
        scanId: scan.id,
        logType: "api",
        message: `Fetched ${data.txs.length} transactions for ${addr}`
      });

      res.json({
        scanId: scan.id,
        address: data.address,
        balance: data.finalBalance / 100000000,
        txCount: data.txCount,
        txs: data.txs.map(tx => ({
          hash: tx.hash,
          time: tx.time,
          result: tx.result,
          fee: tx.fee,
          size: tx.size
        }))
      });
    } catch (error: any) {
      if (error.message === 'API_RATE_LIMIT') {
        res.status(429).json({ error: "API rate limit exceeded. Please wait and try again." });
      } else {
        console.error("BTC address fetch error:", error);
        res.status(500).json({ error: "Failed to fetch address data" });
      }
    }
  });

  app.get("/api/btc/balance/:addr", async (req, res) => {
    try {
      const { addr } = req.params;
      const data = await fetchBtcBalance(addr);
      res.json({ address: addr, balance: data.balance });
    } catch (error) {
      console.error("BTC balance error:", error);
      res.status(500).json({ error: "Failed to fetch balance", address: req.params.addr, balance: 0 });
    }
  });

  app.get("/api/eth/balance/:addr", async (req, res) => {
    try {
      const { addr } = req.params;
      const data = await fetchEthBalance(addr);
      res.json({ address: addr, balance: data.balance });
    } catch (error) {
      console.error("ETH balance error:", error);
      res.status(500).json({ error: "Failed to fetch balance", address: req.params.addr, balance: 0 });
    }
  });

  app.post("/api/synthetic/from-txid", async (req, res) => {
    try {
      const { txid, options } = req.body;

      if (!txid || typeof txid !== 'string') {
        return res.status(400).json({ error: "txid is required" });
      }

      const identity = deriveSyntheticIdentity(txid);

      // If options are provided, return only requested fields
      if (options) {
        const result: any = {
          wif: identity.wif
        };

        if (options.deriveEth) {
          result.ethAddress = identity.ethAddress;
        }

        if (options.deriveBtc) {
          result.btcLegacy = identity.btcLegacy;
          result.btcSegwit = identity.btcSegwit;
          result.btcBech32 = identity.btcBech32;
        }

        return res.json(result);
      }

      res.json(identity);
    } catch (error: any) {
      console.error("Derivation error:", error);
      res.status(500).json({ error: error.message || "Derivation failed" });
    }
  });

  app.post("/api/synthetic/batch", async (req, res) => {
    try {
      const { txids, scanId } = req.body;

      if (!Array.isArray(txids) || txids.length === 0) {
        return res.status(400).json({ error: "txids array is required" });
      }

      const identities = deriveBatch(txids);

      if (scanId) {
        await storage.createDerivedIdentities(
          identities.map(id => ({
            scanId: scanId,
            sourceTxId: id.sourceTxId,
            wif: id.wif,
            ethAddress: id.ethAddress,
            btcLegacy: id.btcLegacy,
            btcSegwit: id.btcSegwit,
            btcBech32: id.btcBech32
          }))
        );

        await storage.updateScan(scanId, { derivedCount: identities.length });

        await storage.createLog({
          scanId: scanId,
          logType: "keygen",
          message: `Derived ${identities.length} synthetic identities`
        });
      }

      res.json({ identities, count: identities.length });
    } catch (error: any) {
      console.error("Batch derivation error:", error);
      res.status(500).json({ error: error.message || "Batch derivation failed" });
    }
  });

  app.get("/api/mempool/live", async (_req, res) => {
    try {
      const data = await fetchMempool();
      res.json({
        count: data.txs.length,
        vsize: data.size,
        totalFee: data.txs.reduce((sum, tx) => sum + (tx.fee || 0), 0),
        feeHistogram: [],
        txs: data.txs,
        feeRates: data.feeRates
      });
    } catch (error) {
      console.error("Mempool error:", error);
      res.status(500).json({ error: "Failed to fetch mempool data", count: 0, vsize: 0, totalFee: 0, feeHistogram: [], txs: [], feeRates: { low: 5, medium: 10, high: 20 } });
    }
  });

  app.get("/api/block/:heightOrHash", async (req, res) => {
    try {
      const { heightOrHash } = req.params;
      const block = await fetchBlock(heightOrHash);

      if (!block) {
        return res.status(404).json({ error: "Block not found" });
      }

      res.json({
        id: block.hash,
        height: block.height,
        version: 0,
        timestamp: block.time,
        tx_count: block.txCount,
        size: block.size,
        weight: block.weight,
        merkle_root: "",
        previousblockhash: "",
        mediantime: block.time,
        nonce: 0,
        bits: 0,
        difficulty: 0
      });
    } catch (error) {
      console.error("Block fetch error:", error);
      res.status(500).json({ error: "Failed to fetch block data" });
    }
  });

  app.post("/api/balance/check-batch", async (req, res) => {
    try {
      const { addresses } = req.body;

      if (!Array.isArray(addresses)) {
        return res.status(400).json({ error: "addresses array required" });
      }

      const results = await Promise.all(
        addresses.map(async (addr: { btc?: string; eth?: string; id?: number }) => {
          const btcBalance = addr.btc ? await fetchBtcBalance(addr.btc) : { balance: 0 };
          const ethBalance = addr.eth ? await fetchEthBalance(addr.eth) : { balance: 0 };

          return {
            id: addr.id,
            btc: btcBalance.balance,
            eth: ethBalance.balance
          };
        })
      );

      res.json({ results });
    } catch (error) {
      console.error("Batch balance error:", error);
      res.status(500).json({ error: "Failed to check balances" });
    }
  });

  app.get("/api/scans/recent", async (_req, res) => {
    try {
      const scans = await storage.getRecentScans(20);
      res.json(scans);
    } catch (error) {
      console.error("Scans fetch error:", error);
      res.status(500).json({ error: "Failed to fetch scans" });
    }
  });

  app.get("/api/scans/:id/identities", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const identities = await storage.getDerivedIdentitiesByScan(id);
      res.json(identities);
    } catch (error) {
      console.error("Identities fetch error:", error);
      res.status(500).json({ error: "Failed to fetch identities" });
    }
  });

  app.get("/api/logs/recent", async (_req, res) => {
    try {
      const logs = await storage.getRecentLogs(100);
      res.json(logs);
    } catch (error) {
      console.error("Logs fetch error:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  return httpServer;
}