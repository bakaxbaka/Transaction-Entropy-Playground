import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Terminal, Search, Key, Shield, Wifi, HardDrive, Download, 
  RefreshCw, Activity, Layers, Play, Settings, Database, 
  Cpu, Signal, Lock, ChevronDown, Radio, AlertCircle
} from "lucide-react";
import { 
  fetchTransactions, 
  txToPrivate, 
  privateToWif, 
  privateToEthAddress, 
  wifToBtcAddresses, 
  checkBalance,
  type Transaction,
  type DerivedIdentity
} from "@/lib/crypto-utils";
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  const { toast } = useToast();

  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      message: msg,
      type
    };
    setLogs(prev => [...prev.slice(-99), newLog]);
  };

  useEffect(() => {
    addLog("System initialized. CryptoHunter v2.0 ready.", "success");
    addLog("Connected to local node [MOCK].", "api");
  }, []);

  const handleFetch = async () => {
    setLoading(true);
    addLog(`Initiating scan for ${address} (Depth: ${scanDepth})...`, "info");
    try {
      const txs = await fetchTransactions(address);
      setTransactions(txs);
      addLog(`Fetched ${txs.length} transactions from blockchain provider.`, "success");
      
      // Auto-process based on options
      addLog("Starting key derivation protocol...", "keygen");
      const derived: DerivedIdentity[] = [];
      
      for (const tx of txs.slice(0, scanDepth)) {
        const privateKey = txToPrivate(tx.hash);
        const wif = privateToWif(privateKey);
        const eth = deriveOptions.deriveEth ? privateToEthAddress(privateKey) : "DISABLED";
        const btcAddrs = wifToBtcAddresses(wif);
        
        derived.push({
          txId: tx.hash,
          privateKey,
          wif,
          ethAddress: eth,
          btcAddresses: btcAddrs,
          balance: { btc: 0, eth: 0 }
        });
      }
      setDerivedData(derived);
      addLog(`Derived ${derived.length} identities from transaction history.`, "success");
      
    } catch (error) {
      addLog(`ERROR: Failed to fetch transactions. API Rate limit or timeout.`, "error");
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: "Could not retrieve blockchain data."
      });
    } finally {
      setLoading(false);
    }
  };

  const checkBalances = async () => {
    addLog("Checking balances for all derived identities...", "info");
    const updated = [...derivedData];
    for (let i = 0; i < updated.length; i++) {
      if (deriveOptions.deriveEth) {
        const ethBal = await checkBalance(updated[i].ethAddress, 'ETH');
        if (ethBal > 0) addLog(`HIT! Found ${ethBal} ETH at ${updated[i].ethAddress}`, "success");
        updated[i].balance.eth = ethBal;
      }
      
      if (deriveOptions.deriveLegacy) {
        const btcBal = await checkBalance(updated[i].btcAddresses.legacy, 'BTC');
        if (btcBal > 0) addLog(`HIT! Found ${btcBal} BTC at ${updated[i].btcAddresses.legacy}`, "success");
        updated[i].balance.btc = btcBal;
      }
      
      setDerivedData([...updated]); // Update progressively
    }
    addLog("Balance scan complete.", "success");
  };

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
    addLog(`Exported ${type.toUpperCase()} dataset to disk.`, "info");
  };

  return (
    <div className="min-h-screen font-mono text-sm relative overflow-hidden flex flex-col">
      <MatrixBackground />
      <div className="scanline-overlay" />

      {/* Header */}
      <header className="relative z-10 border-b border-border bg-background/80 backdrop-blur-md p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/20 flex items-center justify-center border border-primary glow-box relative overflow-hidden">
              <div className="absolute inset-0 bg-primary/20 animate-pulse" />
              <Shield className="w-6 h-6 text-primary relative z-10" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tighter glow-text text-primary flex items-center gap-2">
                CRYPTO<span className="text-foreground">HUNTER</span>
                <span className="text-[10px] bg-primary text-black px-1 rounded ml-2">V2.0</span>
              </h1>
              <p className="text-muted-foreground text-[10px] uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                TxID Heuristic Forensic Analysis
              </p>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex gap-4 text-[10px] font-bold">
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-green-500">
                  <Signal className="w-3 h-3" />
                  <span>NODE: ONLINE</span>
                </div>
                <span className="text-muted-foreground">HEIGHT: 840,291</span>
             </div>
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-amber-500">
                  <Activity className="w-3 h-3" />
                  <span>MEMPOOL: ACTIVE</span>
                </div>
                <span className="text-muted-foreground">PING: 42ms</span>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 relative z-10 overflow-hidden">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 flex flex-col gap-6 h-full overflow-hidden">
          {/* Target Module */}
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
                  />
                  <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#0f0]" />
                </div>
                <div className="flex justify-between text-[10px]">
                   <span className="text-muted-foreground">API Status:</span>
                   <span className="text-green-500 font-bold">OK (Rate Limit: 200/h)</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase text-muted-foreground font-bold">Scan Depth</label>
                <select 
                  value={scanDepth} 
                  onChange={(e) => setScanDepth(Number(e.target.value))}
                  className="w-full bg-card border border-border p-2 text-xs text-foreground outline-none"
                >
                  <option value={10}>Latest 10 TXs (Quick)</option>
                  <option value={50}>Latest 50 TXs (Standard)</option>
                  <option value={100}>Latest 100 TXs (Deep)</option>
                  <option value={1000}>Full History (Slow)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                 <button 
                  onClick={handleFetch}
                  disabled={loading}
                  className="col-span-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary p-3 flex items-center justify-center gap-2 uppercase font-bold transition-all relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-primary/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                  <span className="relative z-10">{loading ? "Scanning..." : "INITIATE SCAN"}</span>
                </button>
                <button onClick={() => downloadData('logs')} className="text-[10px] border border-border hover:border-primary/50 text-muted-foreground hover:text-primary p-2">
                   EXPORT LOGS
                </button>
                <button className="text-[10px] border border-border hover:border-primary/50 text-muted-foreground hover:text-primary p-2">
                   RAW JSON
                </button>
              </div>
            </div>
          </TerminalModule>

          {/* System Log */}
          <SystemLog logs={logs} className="flex-1 min-h-[300px]" />
        </div>

        {/* MAIN PANEL */}
        <div className="lg:col-span-3 flex flex-col h-full overflow-hidden gap-4">
          
          {/* Tabs Navigation */}
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
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'mempool' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse ml-1" />}
              </button>
            ))}
            
            <div className="ml-auto flex items-center pr-4">
              <Dialog>
                <DialogTrigger asChild>
                  <button className="text-muted-foreground hover:text-primary transition-colors">
                    <Settings className="w-5 h-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="bg-card border-primary text-foreground font-mono">
                  <DialogHeader>
                    <DialogTitle className="text-primary uppercase">System Configuration</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between p-2 border border-border">
                       <span>Use Custom RPC</span>
                       <div className="w-4 h-4 border border-primary bg-primary/20" />
                    </div>
                    <div className="flex items-center justify-between p-2 border border-border">
                       <span>Mask Sensitive Data</span>
                       <div className="w-4 h-4 border border-muted" />
                    </div>
                    <div className="flex items-center justify-between p-2 border border-border">
                       <span>Audio Feedback</span>
                       <div className="w-4 h-4 border border-primary bg-primary/20" />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Tab Content */}
          <TerminalModule className="flex-1" glow>
            {activeTab === 'scan' && (
              <div className="flex flex-col h-full">
                {/* Toolbar */}
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
                    <button onClick={checkBalances} disabled={derivedData.length === 0} className="px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 border border-primary/50 text-primary font-bold flex items-center gap-2">
                      <Play className="w-3 h-3" /> CHECK BALANCES
                    </button>
                    <button onClick={() => downloadData('eth')} disabled={derivedData.length === 0} className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 border border-border hover:border-primary text-foreground flex items-center gap-2">
                      <Download className="w-3 h-3" /> ETH
                    </button>
                    <button onClick={() => downloadData('btc')} disabled={derivedData.length === 0} className="px-3 py-1.5 text-xs bg-secondary hover:bg-secondary/80 border border-border hover:border-primary text-foreground flex items-center gap-2">
                      <Download className="w-3 h-3" /> BTC
                    </button>
                  </div>
                </div>

                {/* Data Table */}
                <div className="flex-1 overflow-auto bg-black/20">
                  <table className="w-full text-left border-collapse">
                    <thead className="text-[10px] uppercase text-muted-foreground sticky top-0 bg-card z-10 shadow-lg">
                      <tr>
                        <th className="p-3 border-b border-border bg-card">Source TXID</th>
                        <th className="p-3 border-b border-border bg-card">Synthetic ETH Address</th>
                        <th className="p-3 border-b border-border bg-card">Synthetic BTC (Bech32)</th>
                        <th className="p-3 border-b border-border bg-card text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-mono divide-y divide-border/30">
                      {derivedData.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                            <Cpu className="w-8 h-8 opacity-20" />
                            <span>Awaiting Scan Data...</span>
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
                          >
                            <td className="p-3 text-muted-foreground font-bold group-hover:text-primary transition-colors cursor-help" title={data.txId}>
                              {data.txId.substring(0, 12)}...{data.txId.substring(data.txId.length - 8)}
                            </td>
                            <td className="p-3 text-foreground/80 font-mono">
                              {data.ethAddress === "DISABLED" ? <span className="text-muted-foreground opacity-50">DISABLED</span> : data.ethAddress}
                            </td>
                            <td className="p-3 text-foreground/80 font-mono">
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
              </div>
            )}

            {activeTab === 'mempool' && (
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-border bg-secondary/10 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-amber-500 font-bold uppercase text-xs animate-pulse">
                    <Radio className="w-4 h-4" />
                    Live Data Stream
                  </div>
                  <div className="flex gap-2 text-[10px] text-muted-foreground">
                    <span>TPS: 7.2</span>
                    <span>|</span>
                    <span>Fees: 12-45 sat/vB</span>
                  </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden">
                  <MempoolGraph />
                  
                  <div className="flex-1 overflow-auto border border-border">
                    <table className="w-full text-left">
                      <thead className="bg-card sticky top-0 text-[10px] uppercase text-muted-foreground">
                        <tr>
                          <th className="p-2 border-b border-border">TXID</th>
                          <th className="p-2 border-b border-border">Fee (sat/vB)</th>
                          <th className="p-2 border-b border-border">Value</th>
                          <th className="p-2 border-b border-border text-right">Seen</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px]">
                         {Array.from({length: 15}).map((_, i) => (
                           <tr key={i} className="hover:bg-amber-500/5 border-b border-border/30">
                             <td className="p-2 text-amber-500/80 font-mono">
                               {Math.random().toString(16).substr(2, 16)}...
                             </td>
                             <td className="p-2">{(Math.random() * 50 + 5).toFixed(1)}</td>
                             <td className="p-2">{(Math.random() * 2).toFixed(4)} BTC</td>
                             <td className="p-2 text-right text-muted-foreground">Just now</td>
                           </tr>
                         ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'blocks' && (
              <div className="h-full flex flex-col bg-black/20">
                <div className="p-4 border-b border-border flex gap-4">
                  <input type="text" placeholder="Block Height / Hash" className="bg-input border border-border p-2 text-xs w-64 focus:border-blue-500 outline-none" />
                  <button className="bg-blue-500/10 text-blue-500 border border-blue-500/50 px-4 py-2 text-xs font-bold uppercase hover:bg-blue-500/20">
                    Scan Block
                  </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
                   <div className="col-span-full mb-2 text-xs uppercase font-bold text-muted-foreground">Recent Blocks</div>
                   {Array.from({length: 9}).map((_, i) => (
                      <div key={i} className="bg-card border border-border p-4 hover:border-blue-500/50 transition-colors group relative overflow-hidden">
                         <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                            <Download className="w-4 h-4 text-blue-500" />
                         </div>
                         <div className="flex items-center gap-2 mb-2">
                           <HardDrive className="w-4 h-4 text-blue-500" />
                           <span className="text-lg font-bold text-foreground">#{840290 - i}</span>
                         </div>
                         <div className="space-y-1 text-[10px] text-muted-foreground font-mono">
                           <div className="flex justify-between">
                             <span>Hash:</span>
                             <span className="text-foreground">0000...{Math.random().toString(16).substr(2, 6)}</span>
                           </div>
                           <div className="flex justify-between">
                             <span>TXs:</span>
                             <span className="text-foreground">{(2000 + Math.random() * 1000).toFixed(0)}</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Size:</span>
                             <span className="text-foreground">1.45 MB</span>
                           </div>
                           <div className="flex justify-between">
                             <span>Fees:</span>
                             <span className="text-foreground">0.24 BTC</span>
                           </div>
                         </div>
                         <div className="mt-4 pt-2 border-t border-border flex justify-between items-center opacity-50 group-hover:opacity-100">
                            <span className="text-[10px] text-blue-400">AntPool</span>
                            <span className="text-[10px]">10 mins ago</span>
                         </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </TerminalModule>
        </div>
      </div>
    </div>
  );
}
