import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Search, Key, Shield, Wifi, HardDrive, Download, RefreshCw, Activity, Layers, Play } from "lucide-react";
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

export default function Dashboard() {
  const [address, setAddress] = useState("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [derivedData, setDerivedData] = useState<DerivedIdentity[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'scan' | 'mempool' | 'blocks'>('scan');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleFetch = async () => {
    setLoading(true);
    addLog(`Initiating scan for ${address}...`);
    try {
      const txs = await fetchTransactions(address);
      setTransactions(txs);
      addLog(`Fetched ${txs.length} transactions.`);
      
      // Auto-process
      addLog("Starting automated derivation protocol...");
      const derived: DerivedIdentity[] = [];
      
      for (const tx of txs) {
        const privateKey = txToPrivate(tx.hash);
        const wif = privateToWif(privateKey);
        const eth = privateToEthAddress(privateKey);
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
      addLog(`Derived ${derived.length} identities from transaction history.`);
      
    } catch (error) {
      addLog(`ERROR: Failed to fetch transactions.`);
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
    addLog("Checking balances for all derived identities...");
    const updated = [...derivedData];
    for (let i = 0; i < updated.length; i++) {
      // Check ETH
      const ethBal = await checkBalance(updated[i].ethAddress, 'ETH');
      if (ethBal > 0) addLog(`HIT! Found ${ethBal} ETH at ${updated[i].ethAddress}`);
      
      // Check BTC (Legacy for now)
      const btcBal = await checkBalance(updated[i].btcAddresses.legacy, 'BTC');
      if (btcBal > 0) addLog(`HIT! Found ${btcBal} BTC at ${updated[i].btcAddresses.legacy}`);
      
      updated[i].balance = { eth: ethBal, btc: btcBal };
      setDerivedData([...updated]); // Update progressively
    }
    addLog("Balance scan complete.");
  };

  const downloadEthData = () => {
    const content = derivedData.map(d => `${d.ethAddress},${d.privateKey}`).join('\n');
    downloadFile(`eth_${address}.txt`, content);
    addLog("Exported ETH dataset.");
  };

  const downloadBtcData = () => {
    const content = derivedData.map(d => 
      `TxID: ${d.txId}\nWIF: ${d.wif}\nLegacy: ${d.btcAddresses.legacy}\nSegwit: ${d.btcAddresses.segwit}\nBech32: ${d.btcAddresses.bech32}\n---\n`
    ).join('\n');
    downloadFile(`btc_${address}.txt`, content);
    addLog("Exported BTC dataset.");
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-mono text-sm">
      <header className="mb-8 flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-primary/20 flex items-center justify-center border border-primary">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tighter glow-text text-primary">CRYPTO<span className="text-foreground">HUNTER</span></h1>
            <p className="text-muted-foreground text-xs uppercase tracking-widest">TxID Heuristic Analysis Tool v1.0</p>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 bg-card border border-border">
            <Wifi className="w-3 h-3 text-green-500" />
            <span>NODE: ONLINE</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-card border border-border">
            <Activity className="w-3 h-3 text-amber-500" />
            <span>MEMPOOL: ACTIVE</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-160px)]">
        {/* Left Control Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="terminal-border p-4 space-y-4">
            <label className="text-xs uppercase text-muted-foreground font-bold">Target Address</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-input border border-border p-2 text-xs focus:border-primary outline-none"
              />
            </div>
            <button 
              onClick={handleFetch}
              disabled={loading}
              className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary p-2 flex items-center justify-center gap-2 uppercase font-bold transition-all"
            >
              {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
              {loading ? "Scanning..." : "Initiate Scan"}
            </button>
          </div>

          <div className="terminal-border p-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
              <Terminal className="w-4 h-4 text-primary" />
              <span className="text-xs uppercase font-bold">System Log</span>
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 text-muted-foreground h-40">
              {logs.length === 0 && <span className="opacity-50">System ready. Waiting for input...</span>}
              {logs.map((log, i) => (
                <div key={i} className="break-all hover:text-foreground">{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-border">
            <button 
              onClick={() => setActiveTab('scan')}
              className={`px-4 py-2 text-xs uppercase font-bold flex items-center gap-2 ${activeTab === 'scan' ? 'bg-primary/10 text-primary border-t border-x border-primary border-b-black mb-[-1px]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Key className="w-4 h-4" />
              Key Derivation
            </button>
            <button 
              onClick={() => setActiveTab('mempool')}
              className={`px-4 py-2 text-xs uppercase font-bold flex items-center gap-2 ${activeTab === 'mempool' ? 'bg-primary/10 text-primary border-t border-x border-primary border-b-black mb-[-1px]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Activity className="w-4 h-4" />
              Live Mempool
            </button>
            <button 
              onClick={() => setActiveTab('blocks')}
              className={`px-4 py-2 text-xs uppercase font-bold flex items-center gap-2 ${activeTab === 'blocks' ? 'bg-primary/10 text-primary border-t border-x border-primary border-b-black mb-[-1px]' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Layers className="w-4 h-4" />
              Block Scanner
            </button>
          </div>

          <div className="flex-1 terminal-border p-4 relative overflow-hidden flex flex-col">
            {activeTab === 'scan' && (
              <div className="flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold uppercase text-primary">Derived Identities: {derivedData.length}</h2>
                  <div className="flex gap-2">
                    <button onClick={checkBalances} disabled={derivedData.length === 0} className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 border border-border flex items-center gap-2">
                      <Play className="w-3 h-3 text-green-500" /> Check Balances
                    </button>
                    <button onClick={downloadEthData} disabled={derivedData.length === 0} className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 border border-border flex items-center gap-2">
                      <Download className="w-3 h-3" /> ETH Data
                    </button>
                    <button onClick={downloadBtcData} disabled={derivedData.length === 0} className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 border border-border flex items-center gap-2">
                      <Download className="w-3 h-3" /> BTC Data
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="text-[10px] uppercase text-muted-foreground sticky top-0 bg-card">
                      <tr>
                        <th className="p-2 border-b border-border">Source TxID</th>
                        <th className="p-2 border-b border-border">Derived ETH</th>
                        <th className="p-2 border-b border-border">Derived BTC (Legacy)</th>
                        <th className="p-2 border-b border-border text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-mono">
                      {derivedData.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-muted-foreground">
                            No data derived. Run a scan to begin heuristic analysis.
                          </td>
                        </tr>
                      ) : (
                        derivedData.map((data, i) => (
                          <motion.tr 
                            key={data.txId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="hover:bg-primary/5 group"
                          >
                            <td className="p-2 border-b border-border/50 text-muted-foreground truncate max-w-[150px]" title={data.txId}>
                              {data.txId.substring(0, 16)}...
                            </td>
                            <td className="p-2 border-b border-border/50 text-foreground truncate max-w-[150px]">
                              {data.ethAddress}
                            </td>
                            <td className="p-2 border-b border-border/50 text-foreground truncate max-w-[150px]">
                              {data.btcAddresses.legacy}
                            </td>
                            <td className="p-2 border-b border-border/50 text-right">
                              <div className="flex flex-col">
                                <span className={data.balance.eth > 0 ? "text-green-400 font-bold" : "text-muted-foreground"}>
                                  {data.balance.eth.toFixed(4)} ETH
                                </span>
                                <span className={data.balance.btc > 0 ? "text-amber-400 font-bold" : "text-muted-foreground"}>
                                  {data.balance.btc.toFixed(6)} BTC
                                </span>
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
                 <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold uppercase text-amber-500">Live Mempool Feed</h2>
                    <span className="animate-pulse text-xs text-green-500">● LIVE</span>
                 </div>
                 <div className="space-y-2 overflow-auto pr-2">
                    {Array.from({length: 20}).map((_, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                        className="p-3 bg-secondary/30 border border-border/50 flex justify-between items-center"
                      >
                         <div className="flex flex-col gap-1">
                           <div className="text-xs text-primary font-bold">TX: {Math.random().toString(16).substr(2, 32)}...</div>
                           <div className="text-[10px] text-muted-foreground">{new Date().toLocaleTimeString()} • {(Math.random() * 5).toFixed(2)} vB/s</div>
                         </div>
                         <div className="text-right">
                           <div className="text-sm font-bold">{(Math.random() * 2).toFixed(5)} BTC</div>
                           <div className="text-[10px] text-muted-foreground">Fee: {(Math.random() * 0.001).toFixed(6)}</div>
                         </div>
                      </motion.div>
                    ))}
                 </div>
              </div>
            )}
            
            {activeTab === 'blocks' && (
              <div className="h-full flex flex-col">
                 <h2 className="text-sm font-bold uppercase text-blue-500 mb-4">Recent Blocks</h2>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-auto">
                    {Array.from({length: 12}).map((_, i) => (
                      <div key={i} className="aspect-square bg-card border border-border p-4 flex flex-col justify-between hover:border-primary transition-colors cursor-pointer group">
                         <div className="flex justify-between items-start">
                           <HardDrive className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                           <span className="text-xs text-muted-foreground">#{800000 + i}</span>
                         </div>
                         <div>
                           <div className="text-2xl font-bold text-foreground">{(Math.random() * 10 + 1).toFixed(2)} MB</div>
                           <div className="text-[10px] text-muted-foreground">{(1000 + Math.random() * 2000).toFixed(0)} TXs</div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
