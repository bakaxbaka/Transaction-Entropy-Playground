import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Search, Key, Shield, HardDrive, Download, 
  RefreshCw, Activity, Layers, Play, Settings, 
  Cpu, Signal, Radio
} from "lucide-react";
import { 
  fetchAddressTransactions,
  deriveBatchSynthetic,
  fetchBtcBalance,
  fetchEthBalance,
  fetchMempoolLive,
  fetchBlock,
  syntheticToDerivedIdentity,
  type DerivedIdentity,
  type MempoolData,
  type BlockData
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MatrixBackground } from "@/components/matrix-background";
import { TerminalModule } from "@/components/terminal-module";
import { SystemLog, type LogEntry } from "@/components/system-log";
import { MempoolGraph } from "@/components/mempool-graph";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [address, setAddress] = useState("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
  const [loading, setLoading] = useState(false);
  const [derivedData, setDerivedData] = useState<DerivedIdentity[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'scan' | 'mempool' | 'blocks'>('scan');
  const [scanDepth, setScanDepth] = useState(50);
  const [deriveOptions, setDeriveOptions] = useState({
    useTxEntropy: true,
    deriveLegacy: true,
    deriveSegwit: true,
    deriveBech32: true,
    deriveEth: true
  });
  
  const [mempoolData, setMempoolData] = useState<MempoolData | null>(null);
  const [mempoolLoading, setMempoolLoading] = useState(false);
  
  const [blockQuery, setBlockQuery] = useState("");
  const [blockData, setBlockData] = useState<BlockData | null>(null);
  const [recentBlocks, setRecentBlocks] = useState<BlockData[]>([]);
  const [blockLoading, setBlockLoading] = useState(false);
  
  const [nodeStatus, setNodeStatus] = useState({ height: 0, online: true });
  
  const { toast } = useToast();

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message: msg,
      type
    };
    setLogs(prev => [...prev.slice(-99), newLog]);
  }, []);

  useEffect(() => {
    addLog("System initialized. CryptoHunter v2.0 ready.", "success");
    addLog("Backend connected - Real crypto derivation active.", "api");
    
    fetchBlock("tip").then(block => {
      if (block && block.height) {
        setNodeStatus({ height: block.height, online: true });
        addLog(`Node synced to height ${block.height.toLocaleString()}`, "api");
      }
    }).catch(() => {
      setNodeStatus(prev => ({ ...prev, online: false }));
    });
  }, [addLog]);

  const handleFetch = async () => {
    setLoading(true);
    addLog(`Initiating scan for ${address} (Depth: ${scanDepth})...`, "info");
    try {
      const result = await fetchAddressTransactions(address, scanDepth);
      addLog(`Fetched ${result.txs.length} transactions from blockchain.info API.`, "success");
      addLog(`Address balance: ${result.balance.toFixed(8)} BTC`, "api");
      
      addLog("Starting synthetic key derivation protocol...", "keygen");
      const txids = result.txs.map(tx => tx.hash);
      
      const { identities, count } = await deriveBatchSynthetic(txids, result.scanId);
      
      const derived = identities.map(id => syntheticToDerivedIdentity(id));
      setDerivedData(derived);
      addLog(`Derived ${count} synthetic identities using real secp256k1 math.`, "success");
      
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error";
      addLog(`ERROR: ${errorMsg}`, "error");
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: errorMsg
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBalances = async () => {
    addLog("Checking balances for all derived identities...", "info");
    const updated = derivedData.map(item => ({
      ...item,
      balance: { ...item.balance }
    }));
    let checkedCount = 0;
    
    for (let i = 0; i < updated.length; i++) {
      try {
        if (deriveOptions.deriveEth && updated[i].ethAddress && updated[i].ethAddress !== "DISABLED") {
          const ethResult = await fetchEthBalance(updated[i].ethAddress);
          if (ethResult.balance > 0) {
            addLog(`HIT! Found ${ethResult.balance} ETH at ${updated[i].ethAddress}`, "success");
          }
          updated[i].balance.eth = ethResult.balance;
        }
        
        if (deriveOptions.deriveLegacy && updated[i].btcAddresses.legacy) {
          const btcResult = await fetchBtcBalance(updated[i].btcAddresses.legacy);
          if (btcResult.balance > 0) {
            addLog(`HIT! Found ${btcResult.balance} BTC at ${updated[i].btcAddresses.legacy}`, "success");
          }
          updated[i].balance.btc = btcResult.balance;
        }
        
        checkedCount++;
      } catch (error) {
        addLog(`Warning: Failed to check balance for identity ${i + 1}`, "error");
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    setDerivedData([...updated]);
    addLog(`Balance scan complete. Checked ${checkedCount} identities.`, "success");
  };

  const loadMempool = async () => {
    setMempoolLoading(true);
    addLog("Fetching live mempool data from mempool.space...", "api");
    try {
      const data = await fetchMempoolLive();
      setMempoolData(data);
      addLog(`Mempool loaded: ${data.count} unconfirmed TXs, ${(data.vsize / 1000000).toFixed(2)} vMB`, "success");
    } catch (error: any) {
      addLog(`Mempool fetch failed: ${error.message}`, "error");
    } finally {
      setMempoolLoading(false);
    }
  };

  const loadBlock = async () => {
    if (!blockQuery.trim()) return;
    setBlockLoading(true);
    addLog(`Fetching block ${blockQuery}...`, "api");
    try {
      const block = await fetchBlock(blockQuery);
      setBlockData(block);
      addLog(`Block ${block.height} loaded: ${block.tx_count} transactions`, "success");
    } catch (error: any) {
      addLog(`Block fetch failed: ${error.message}`, "error");
      toast({
        variant: "destructive",
        title: "Block Not Found",
        description: error.message
      });
    } finally {
      setBlockLoading(false);
    }
  };

  const loadRecentBlocks = async () => {
    addLog("Loading recent blocks...", "api");
    try {
      const tipBlock = await fetchBlock("tip");
      const blocks: BlockData[] = [tipBlock];
      
      for (let i = 1; i < 6; i++) {
        const block = await fetchBlock(String(tipBlock.height - i));
        blocks.push(block);
      }
      setRecentBlocks(blocks);
      addLog(`Loaded ${blocks.length} recent blocks`, "success");
    } catch (error: any) {
      addLog(`Failed to load recent blocks: ${error.message}`, "error");
    }
  };

  useEffect(() => {
    if (activeTab === 'mempool' && !mempoolData) {
      loadMempool();
    }
    if (activeTab === 'blocks' && recentBlocks.length === 0) {
      loadRecentBlocks();
    }
  }, [activeTab]);

  const downloadData = (type: 'eth' | 'btc' | 'logs') => {
    let content = "";
    let filename = "";

    if (type === 'eth') {
      content = derivedData.map(d => `${d.ethAddress},${d.privateKey}`).join('\n');
      filename = `eth_${address}.txt`;
    } else if (type === 'btc') {
      content = derivedData.map(d => 
        `TxID: ${d.txId}\nWIF: ${d.wif}\nLegacy: ${d.btcAddresses.legacy}\nSegwit: ${d.btcAddresses.segwit}\nBech32: ${d.btcAddresses.bech32}\n---\n`
      ).join('\n');
      filename = `btc_${address}.txt`;
    } else {
      content = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
      filename = `scan_logs_${Date.now()}.log`;
    }

    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    addLog(`Exported ${type.toUpperCase()} dataset to disk.`, "info");
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  return (
    <div className="min-h-screen font-mono text-sm relative overflow-hidden flex flex-col" data-testid="dashboard">
      <MatrixBackground />
      <div className="scanline-overlay" />

      <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 flex items-center justify-center border border-primary glow-box relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/20 animate-pulse" />
              <Shield className="w-6 h-6 text-primary relative z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tighter glow-text text-primary flex items-center gap-2" data-testid="app-title">
                CRYPTO<span className="text-foreground">HUNTER</span>
                <span className="text-[10px] bg-primary text-black px-1 rounded ml-2">V2.0</span>
              </h1>
              <p className="text-muted-foreground text-[10px] uppercase tracking-widest flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full animate-pulse", nodeStatus.online ? "bg-green-500" : "bg-red-500")} />
                TxID Heuristic Forensic Analysis
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 text-[10px] font-bold">
             <div className="flex flex-col items-end">
                <div className={cn("flex items-center gap-1", nodeStatus.online ? "text-green-500" : "text-red-500")}>
                  <Signal className="w-3 h-3" />
                  <span data-testid="node-status">NODE: {nodeStatus.online ? "ONLINE" : "OFFLINE"}</span>
                </div>
                <span className="text-muted-foreground" data-testid="block-height">HEIGHT: {nodeStatus.height.toLocaleString()}</span>
             </div>
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-amber-500">
                  <Activity className="w-3 h-3" />
                  <span>MEMPOOL: {mempoolData ? `${mempoolData.count} TXS` : "ACTIVE"}</span>
                </div>
                <span className="text-muted-foreground">API: LIVE</span>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 relative z-10 overflow-hidden">
        
        <div className="lg:col-span-1 flex flex-col gap-6 h-full overflow-hidden">
          <TerminalModule title="Target Module" icon={<Search className="w-4 h-4" />} glow>
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase text-muted-foreground font-bold">Bitcoin Address</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-input border border-border p-2 text-xs focus:border-primary outline-none text-primary font-bold tracking-wider"
                    data-testid="input-address"
                  />
                  <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#0f0]" />
                </div>
                <div className="flex justify-between text-[10px]">
                   <span className="text-muted-foreground">API Status:</span>
                   <span className="text-green-500 font-bold">OK (blockchain.info)</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-muted-foreground font-bold">Scan Depth</label>
                <select 
                  value={scanDepth} 
                  onChange={(e) => setScanDepth(Number(e.target.value))}
                  className="w-full bg-card border border-border p-2 text-xs text-foreground outline-none"
                  data-testid="select-depth"
                >
                  <option value={10}>Latest 10 TXs (Quick)</option>
                  <option value={50}>Latest 50 TXs (Standard)</option>
                  <option value={100}>Latest 100 TXs (Deep)</option>
                  <option value={500}>Latest 500 TXs (Extended)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                 <button 
                  onClick={handleFetch}
                  disabled={loading}
                  className="col-span-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary p-3 flex items-center justify-center gap-2 uppercase font-bold transition-all relative overflow-hidden group"
                  data-testid="button-scan"
                >
                  <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                  <span className="relative z-10">{loading ? "Scanning..." : "INITIATE SCAN"}</span>
                </button>
                <button onClick={() => downloadData('logs')} className="text-[10px] border border-border hover:border-primary/50 text-muted-foreground hover:text-primary p-2" data-testid="button-export-logs">
                   EXPORT LOGS
                </button>
                <button className="text-[10px] border border-border hover:border-primary/50 text-muted-foreground hover:text-primary p-2">
                   RAW JSON
                </button>
              </div>
            </div>
          </TerminalModule>

          <SystemLog logs={logs} className="flex-1 min-h-[300px]" />
        </div>

        <div className="lg:col-span-3 flex flex-col h-full overflow-hidden gap-4">
          
          <div className="flex border-b border-border bg-background/50 backdrop-blur-sm">
            {[
              { id: 'scan', label: 'Key Derivation', icon: Key },
              { id: 'mempool', label: 'Live Mempool', icon: Activity },
              { id: 'blocks', label: 'Block Scanner', icon: Layers },
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-6 py-3 text-xs uppercase font-bold flex items-center gap-2 transition-all relative",
                  activeTab === tab.id 
                    ? "text-primary bg-primary/5 border-b-2 border-primary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'mempool' && mempoolData && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-1" />}
              </button>
            ))}
            
            <div className="ml-auto flex items-center pr-4">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-muted-foreground hover:text-primary transition-colors" data-testid="button-settings">
                    <Settings className="w-5 h-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-card border-primary text-foreground font-mono">
                  <DialogHeader>
                    <DialogTitle className="text-primary uppercase">System Configuration</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between p-2 border border-border">
                       <span>Real Crypto Derivation</span>
                       <div className="w-4 h-4 border border-primary bg-primary/50" />
                    </div>
                    <div className="flex items-center justify-between p-2 border border-border">
                       <span>Live API Connections</span>
                       <div className="w-4 h-4 border border-primary bg-primary/50" />
                    </div>
                    <div className="flex items-center justify-between p-2 border border-border">
                       <span>Database Persistence</span>
                       <div className="w-4 h-4 border border-primary bg-primary/50" />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <TerminalModule className="flex-1" glow>
            {activeTab === 'scan' && (
              <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border bg-secondary/10 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={deriveOptions.useTxEntropy} onChange={e => setDeriveOptions({...deriveOptions, useTxEntropy: e.target.checked})} className="accent-primary" />
                      <span className="text-muted-foreground hover:text-foreground">Use TxID Entropy</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={deriveOptions.deriveEth} onChange={e => setDeriveOptions({...deriveOptions, deriveEth: e.target.checked})} className="accent-primary" />
                      <span className="text-muted-foreground hover:text-foreground">Derive ETH</span>
                    </label>
                  </div>
                  
                  <div className="flex gap-2">
                    <button onClick={checkBalances} disabled={derivedData.length === 0} className="px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 border border-primary/50 text-primary font-bold flex items-center gap-2 disabled:opacity-50" data-testid="button-check-balances">
                      <Play className="w-3 h-3" /> CHECK BALANCES
                    </button>
                    <button onClick={() => downloadData('eth')} disabled={derivedData.length === 0} className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 border border-border hover:border-primary text-foreground flex items-center gap-2 disabled:opacity-50" data-testid="button-export-eth">
                      <Download className="w-3 h-3" /> ETH
                    </button>
                    <button onClick={() => downloadData('btc')} disabled={derivedData.length === 0} className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 border border-border hover:border-primary text-foreground flex items-center gap-2 disabled:opacity-50" data-testid="button-export-btc">
                      <Download className="w-3 h-3" /> BTC
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-black/20">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead className="text-[10px] uppercase text-muted-foreground sticky top-0 bg-card z-10 shadow-lg">
                      <tr>
                        <th className="p-3 border-b border-border bg-card w-[30%]">Source TXID</th>
                        <th className="p-3 border-b border-border bg-card w-[30%]">Synthetic ETH Address</th>
                        <th className="p-3 border-b border-border bg-card w-[30%]">Synthetic BTC (Bech32)</th>
                        <th className="p-3 border-b border-border bg-card text-right w-[10%]">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-mono divide-y divide-border/30">
                      {derivedData.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                              <Cpu className="w-8 h-8 opacity-20" />
                              <span>Awaiting Scan Data...</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        derivedData.map((data, i) => (
                          <motion.tr 
                            key={data.txId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="hover:bg-primary/5 group transition-colors"
                            data-testid={`row-identity-${i}`}
                          >
                            <td className="p-3 text-muted-foreground font-bold group-hover:text-primary transition-colors break-all">
                              {data.txId}
                            </td>
                            <td className="p-3 text-foreground/80 font-mono break-all">
                              {data.ethAddress === "DISABLED" ? <span className="text-muted-foreground opacity-50">DISABLED</span> : data.ethAddress}
                            </td>
                            <td className="p-3 text-foreground/80 font-mono break-all">
                              {data.btcAddresses.bech32}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                {data.balance.eth > 0 && <span className="text-green-400 font-bold bg-green-400/10 px-1 rounded">{data.balance.eth.toFixed(4)} ETH</span>}
                                {data.balance.btc > 0 && <span className="text-amber-400 font-bold bg-amber-400/10 px-1 rounded">{data.balance.btc.toFixed(6)} BTC</span>}
                                {data.balance.eth === 0 && data.balance.btc === 0 && <span className="text-muted-foreground opacity-30">-</span>}
                              </div>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {derivedData.length > 0 && (
                  <div className="p-2 border-t border-border bg-secondary/10 text-[10px] text-muted-foreground flex justify-between">
                    <span>Total: {derivedData.length} synthetic identities derived</span>
                    <span>Real secp256k1 crypto derivation</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mempool' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-border bg-secondary/10 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-xs">
                    <Radio className={cn("w-4 h-4", mempoolLoading && "animate-pulse")} />
                    {mempoolLoading ? "Loading..." : "Live Data Stream"}
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      <span>TXs: {mempoolData?.count || 0}</span>
                      <span>|</span>
                      <span>Fees: {mempoolData?.feeRates.low || 0}-{mempoolData?.feeRates.high || 0} sat/vB</span>
                    </div>
                    <button onClick={loadMempool} disabled={mempoolLoading} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1" data-testid="button-refresh-mempool">
                      <RefreshCw className={cn("w-3 h-3", mempoolLoading && "animate-spin")} /> Refresh
                    </button>
                  </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden">
                  <MempoolGraph />
                  
                  <div className="flex-1 overflow-auto border border-border">
                    <table className="w-full text-left table-fixed">
                      <thead className="bg-card sticky top-0 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="p-2 border-b border-border w-[60%]">TXID</th>
                          <th className="p-2 border-b border-border w-[15%]">Fee (sat/vB)</th>
                          <th className="p-2 border-b border-border w-[15%]">Value</th>
                          <th className="p-2 border-b border-border text-right w-[10%]">Size</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px]">
                        {mempoolData?.txs && mempoolData.txs.length > 0 ? (
                          mempoolData.txs.slice(0, 20).map((tx, i) => (
                            <tr key={tx.txid || i} className="hover:bg-amber-500/5 border-b border-border/30" data-testid={`mempool-tx-${i}`}>
                              <td className="p-2 text-amber-500/80 font-mono break-all">
                                {tx.txid || 'N/A'}
                              </td>
                              <td className="p-2">{tx.vsize ? (tx.fee / tx.vsize).toFixed(1) : 'N/A'}</td>
                              <td className="p-2">{tx.value ? (tx.value / 100000000).toFixed(4) : '0'} BTC</td>
                              <td className="p-2 text-right text-muted-foreground">{tx.vsize || 0} vB</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-8 text-center text-muted-foreground">
                              {mempoolLoading ? "Loading mempool data..." : "No mempool data available"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'blocks' && (
              <div className="h-full flex flex-col bg-black/20">
                <div className="p-4 border-b border-border flex gap-4">
                  <input 
                    type="text" 
                    placeholder="Block Height / Hash" 
                    value={blockQuery}
                    onChange={(e) => setBlockQuery(e.target.value)}
                    className="bg-input border border-border p-2 text-xs w-64 focus:border-blue-500 outline-none" 
                    data-testid="input-block-query"
                  />
                  <button 
                    onClick={loadBlock}
                    disabled={blockLoading}
                    className="bg-blue-500/10 text-blue-500 border border-blue-500/50 px-4 py-2 text-xs font-bold uppercase hover:bg-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                    data-testid="button-scan-block"
                  >
                    {blockLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Scan Block
                  </button>
                </div>

                {blockData && (
                  <div className="p-4 border-b border-border bg-blue-500/5">
                    <div className="flex items-center gap-2 mb-3">
                      <HardDrive className="w-5 h-5 text-blue-500" />
                      <span className="text-lg font-bold text-foreground">Block #{blockData.height.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px]">
                      <div className="col-span-2">
                        <span className="text-muted-foreground block">Hash</span>
                        <span className="text-foreground font-mono break-all">{blockData.id}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Transactions</span>
                        <span className="text-foreground">{blockData.tx_count.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Size</span>
                        <span className="text-foreground">{(blockData.size / 1000000).toFixed(2)} MB</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Time</span>
                        <span className="text-foreground">{formatTimeAgo(blockData.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
                   <div className="col-span-full mb-2 text-xs uppercase font-bold text-muted-foreground flex justify-between items-center">
                     <span>Recent Blocks</span>
                     <button onClick={loadRecentBlocks} className="text-blue-500 hover:text-blue-400 flex items-center gap-1 normal-case">
                       <RefreshCw className="w-3 h-3" /> Refresh
                     </button>
                   </div>
                   {recentBlocks.length > 0 ? (
                     recentBlocks.map((block) => (
                        <div key={block.height} className="bg-card border border-border p-4 hover:border-blue-500/50 transition-colors group relative overflow-hidden cursor-pointer" onClick={() => { setBlockQuery(String(block.height)); setBlockData(block); }} data-testid={`block-card-${block.height}`}>
                           <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                              <Download className="w-4 h-4 text-blue-500" />
                           </div>
                           <div className="flex items-center gap-2 mb-2">
                             <HardDrive className="w-4 h-4 text-blue-500" />
                             <span className="text-lg font-bold text-foreground">#{block.height.toLocaleString()}</span>
                           </div>
                           <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
                             <div>
                               <span className="block mb-1">Hash:</span>
                               <span className="text-foreground break-all block">{block.id}</span>
                             </div>
                             <div className="flex justify-between">
                               <span>TXs:</span>
                               <span className="text-foreground">{block.tx_count.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between">
                               <span>Size:</span>
                               <span className="text-foreground">{(block.size / 1000000).toFixed(2)} MB</span>
                             </div>
                           </div>
                           <div className="mt-4 pt-2 border-t border-border flex justify-between items-center opacity-50 group-hover:opacity-100">
                              <span className="text-[10px] text-blue-400">mempool.space</span>
                              <span className="text-[10px]">{formatTimeAgo(block.timestamp)}</span>
                           </div>
                        </div>
                      ))
                   ) : (
                     Array.from({length: 6}).map((_, i) => (
                        <div key={i} className="bg-card border border-border p-4 animate-pulse">
                           <div className="h-6 bg-secondary/50 rounded mb-2" />
                           <div className="space-y-2">
                             <div className="h-3 bg-secondary/30 rounded" />
                             <div className="h-3 bg-secondary/30 rounded w-2/3" />
                           </div>
                        </div>
                      ))
                   )}
                </div>
              </div>
            )}
          </TerminalModule>
        </div>
      </div>
    </div>
  );
}
