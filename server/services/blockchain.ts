export interface BlockchainTx {
  hash: string;
  time: number;
  result: number;
  fee: number;
  size: number;
  inputs: { prev_out: { addr: string; value: number } }[];
  out: { addr: string; value: number; spent: boolean }[];
}

export interface AddressData {
  address: string;
  finalBalance: number;
  totalReceived: number;
  totalSent: number;
  txCount: number;
  txs: BlockchainTx[];
}

export interface MempoolTx {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
  firstSeen: number;
  feeRate: number;
}

export interface BlockData {
  height: number;
  hash: string;
  time: number;
  txCount: number;
  size: number;
  weight: number;
  fee: number;
  miner: string;
  txs: { hash: string; fee: number; size: number; value: number }[];
}

export async function fetchAddressData(address: string, limit = 50): Promise<AddressData> {
  const url = `https://blockchain.info/rawaddr/${address}?limit=${limit}`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    }
  });
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API_RATE_LIMIT');
    }
    throw new Error(`Blockchain API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    address: data.address,
    finalBalance: data.final_balance || 0,
    totalReceived: data.total_received || 0,
    totalSent: data.total_sent || 0,
    txCount: data.n_tx || 0,
    txs: (data.txs || []).map((tx: any) => ({
      hash: tx.hash,
      time: tx.time,
      result: tx.result,
      fee: tx.fee || 0,
      size: tx.size || 0,
      inputs: tx.inputs || [],
      out: tx.out || []
    }))
  };
}

export async function fetchBtcBalance(address: string): Promise<{ balance: number; confirmed: number; unconfirmed: number }> {
  const url = `https://blockchain.info/balance?active=${address}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('API_RATE_LIMIT');
    }
    throw new Error(`Balance API error: ${response.status}`);
  }
  
  const data = await response.json();
  const addressData = data[address] || { final_balance: 0 };
  
  return {
    balance: addressData.final_balance / 100000000,
    confirmed: addressData.final_balance / 100000000,
    unconfirmed: 0
  };
}

export async function fetchEthBalance(address: string): Promise<{ balance: number }> {
  const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`;
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return { balance: 0 };
    }
    
    const data = await response.json();
    
    if (data.status === '1' && data.result) {
      const balanceWei = BigInt(data.result);
      const balanceEth = Number(balanceWei) / 1e18;
      return { balance: balanceEth };
    }
    
    return { balance: 0 };
  } catch {
    return { balance: 0 };
  }
}

export async function fetchMempool(): Promise<{ size: number; txs: MempoolTx[]; feeRates: { low: number; medium: number; high: number } }> {
  try {
    const [mempoolRes, feesRes] = await Promise.all([
      fetch('https://mempool.space/api/mempool'),
      fetch('https://mempool.space/api/v1/fees/recommended')
    ]);
    
    const mempoolData = await mempoolRes.json();
    const feesData = await feesRes.json();
    
    const recentTxsRes = await fetch('https://mempool.space/api/mempool/recent');
    const recentTxs = await recentTxsRes.json();
    
    return {
      size: mempoolData.vsize || 0,
      feeRates: {
        low: feesData.hourFee || 5,
        medium: feesData.halfHourFee || 10,
        high: feesData.fastestFee || 20
      },
      txs: (recentTxs || []).slice(0, 50).map((tx: any) => ({
        txid: tx.txid,
        fee: tx.fee || 0,
        vsize: tx.vsize || tx.size || 0,
        value: tx.value || 0,
        firstSeen: Date.now() / 1000,
        feeRate: tx.fee && tx.vsize ? (tx.fee / tx.vsize).toFixed(1) : 0
      }))
    };
  } catch (error) {
    console.error('Mempool fetch error:', error);
    return {
      size: 0,
      feeRates: { low: 5, medium: 10, high: 20 },
      txs: []
    };
  }
}

export async function fetchBlock(heightOrHash: string): Promise<BlockData | null> {
  try {
    let hash = heightOrHash;
    
    if (/^\d+$/.test(heightOrHash)) {
      const hashRes = await fetch(`https://mempool.space/api/block-height/${heightOrHash}`);
      if (!hashRes.ok) return null;
      hash = await hashRes.text();
    }
    
    const blockRes = await fetch(`https://mempool.space/api/block/${hash}`);
    if (!blockRes.ok) return null;
    
    const block = await blockRes.json();
    
    const txsRes = await fetch(`https://mempool.space/api/block/${hash}/txs/0`);
    const txs = txsRes.ok ? await txsRes.json() : [];
    
    return {
      height: block.height,
      hash: block.id,
      time: block.timestamp,
      txCount: block.tx_count,
      size: block.size,
      weight: block.weight,
      fee: block.extras?.totalFees || 0,
      miner: block.extras?.pool?.name || 'Unknown',
      txs: txs.slice(0, 25).map((tx: any) => ({
        hash: tx.txid,
        fee: tx.fee || 0,
        size: tx.size || tx.vsize || 0,
        value: tx.vout?.reduce((sum: number, out: any) => sum + (out.value || 0), 0) || 0
      }))
    };
  } catch (error) {
    console.error('Block fetch error:', error);
    return null;
  }
}
