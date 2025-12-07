export interface Transaction {
  hash: string;
  time: number;
  result: number;
  fee: number;
  size: number;
}

export interface ScanResult {
  scanId: number;
  address: string;
  balance: number;
  txCount: number;
  txs: Transaction[];
}

export interface SyntheticIdentity {
  sourceTxId: string;
  privateKeyHex: string;
  wif: string;
  ethAddress: string;
  btcLegacy: string;
  btcSegwit: string;
  btcBech32: string;
}

export interface DerivedIdentity {
  txId: string;
  privateKey: string;
  wif: string;
  ethAddress: string;
  btcAddresses: {
    legacy: string;
    segwit: string;
    bech32: string;
  };
  balance: {
    btc: number;
    eth: number;
  };
}

export interface MempoolTx {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}

export interface MempoolData {
  count: number;
  vsize: number;
  totalFee: number;
  feeHistogram: Array<[number, number]>;
  txs: MempoolTx[];
  feeRates: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface BlockData {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchAddressTransactions(address: string, limit: number = 50): Promise<ScanResult> {
  const response = await fetch(`/api/btc/address/${encodeURIComponent(address)}?limit=${limit}`);
  return handleResponse<ScanResult>(response);
}

export async function deriveSyntheticFromTxid(txid: string): Promise<SyntheticIdentity> {
  const response = await fetch('/api/synthetic/from-txid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid })
  });
  return handleResponse<SyntheticIdentity>(response);
}

export async function deriveBatchSynthetic(txids: string[], scanId?: number): Promise<{ identities: SyntheticIdentity[]; count: number }> {
  const response = await fetch('/api/synthetic/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txids, scanId })
  });
  return handleResponse<{ identities: SyntheticIdentity[]; count: number }>(response);
}

export async function fetchBtcBalance(address: string): Promise<{ address: string; balance: number }> {
  const response = await fetch(`/api/btc/balance/${encodeURIComponent(address)}`);
  return handleResponse<{ address: string; balance: number }>(response);
}

export async function fetchEthBalance(address: string): Promise<{ address: string; balance: number }> {
  const response = await fetch(`/api/eth/balance/${encodeURIComponent(address)}`);
  return handleResponse<{ address: string; balance: number }>(response);
}

export async function checkBatchBalances(addresses: Array<{ id: number; btc?: string; eth?: string }>): Promise<{ results: Array<{ id: number; btc: number; eth: number }> }> {
  const response = await fetch('/api/balance/check-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses })
  });
  return handleResponse<{ results: Array<{ id: number; btc: number; eth: number }> }>(response);
}

export async function fetchMempoolLive(): Promise<MempoolData> {
  const response = await fetch('/api/mempool/live');
  return handleResponse<MempoolData>(response);
}

export async function fetchBlock(heightOrHash: string): Promise<BlockData> {
  const response = await fetch(`/api/block/${encodeURIComponent(heightOrHash)}`);
  return handleResponse<BlockData>(response);
}

export async function fetchRecentScans(): Promise<any[]> {
  const response = await fetch('/api/scans/recent');
  return handleResponse<any[]>(response);
}

export async function fetchRecentLogs(): Promise<any[]> {
  const response = await fetch('/api/logs/recent');
  return handleResponse<any[]>(response);
}

export function syntheticToDerivedIdentity(synthetic: SyntheticIdentity): DerivedIdentity {
  return {
    txId: synthetic.sourceTxId,
    privateKey: synthetic.privateKeyHex,
    wif: synthetic.wif,
    ethAddress: synthetic.ethAddress,
    btcAddresses: {
      legacy: synthetic.btcLegacy,
      segwit: synthetic.btcSegwit,
      bech32: synthetic.btcBech32
    },
    balance: { btc: 0, eth: 0 }
  };
}

export async function deriveFromTxId(
  txid: string, 
  options: { deriveEth: boolean; deriveBtc: boolean }
): Promise<{ 
  wif: string; 
  ethAddress?: string; 
  btcLegacy?: string; 
  btcSegwit?: string; 
  btcBech32?: string; 
} | null> {
  try {
    const response = await fetch('/api/synthetic/from-txid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txid, options })
    });
    
    if (!response.ok) {
      return null;
    }
    
    const identity = await response.json();
    
    return {
      wif: identity.wif,
      ethAddress: options.deriveEth ? identity.ethAddress : undefined,
      btcLegacy: options.deriveBtc ? identity.btcLegacy : undefined,
      btcSegwit: options.deriveBtc ? identity.btcSegwit : undefined,
      btcBech32: options.deriveBtc ? identity.btcBech32 : undefined,
    };
  } catch (error) {
    console.error('Failed to derive from txid:', error);
    return null;
  }
}
