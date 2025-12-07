import { AddressData, BlockData, MempoolTx } from "../client/src/lib/api";

const BLOCKSTREAM_API = "https://blockstream.info/api";

// --- BTC Address Data ---

export async function fetchAddressData(address: string, limit = 50): Promise<AddressData> {
  // Blockstream API does not support transaction limit directly on address endpoint.
  // We fetch the address info and then the latest transactions.
  const addressUrl = `${BLOCKSTREAM_API}/address/${address}`;
  const txsUrl = `${BLOCKSTREAM_API}/address/${address}/txs`;

  const addressResponse = await fetch(addressUrl);
  if (!addressResponse.ok) {
    throw new Error(`Blockstream Address API error: ${addressResponse.status}`);
  }
  const addressData = await addressResponse.json();

  const txsResponse = await fetch(txsUrl);
  if (!txsResponse.ok) {
    throw new Error(`Blockstream Txs API error: ${txsResponse.status}`);
  }
  const txsData = await txsResponse.json();

  // Map Blockstream data to the expected AddressData interface
  const txs = txsData.slice(0, limit).map((tx: any) => ({
    hash: tx.txid,
    time: tx.status.block_time,
    result: tx.vout.reduce((sum: number, output: any) => sum + output.value, 0), // Simplified result for now
    fee: tx.fee,
    size: tx.size,
    inputs: tx.vin.map((input: any) => ({ prev_out: { addr: input.prevout.scriptpubkey_address, value: input.prevout.value } })),
    out: tx.vout.map((output: any) => ({ addr: output.scriptpubkey_address, value: output.value, spent: output.status.spent }))
  }));

  return {
    address: address,
    finalBalance: addressData.chain_stats.funded_txo_sum - addressData.chain_stats.spent_txo_sum,
    totalReceived: addressData.chain_stats.funded_txo_sum,
    totalSent: addressData.chain_stats.spent_txo_sum,
    txCount: addressData.chain_stats.tx_count,
    txs: txs
  };
}

// --- BTC Balance ---

export async function fetchBtcBalance(address: string): Promise<{ balance: number; confirmed: number; unconfirmed: number }> {
  const url = `${BLOCKSTREAM_API}/address/${address}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Blockstream Balance API error: ${response.status}`);
  }

  const data = await response.json();
  const balance = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 100000000;
  const confirmed = (data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum) / 100000000;
  const unconfirmed = (data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum) / 100000000;

  return {
    balance: balance,
    confirmed: confirmed,
    unconfirmed: unconfirmed
  };
}

// --- ETH Balance (Using Etherscan as before) ---

export async function fetchEthBalance(address: string): Promise<{ balance: number }> {
  const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Etherscan Balance API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.status !== "1") {
    throw new Error(`Etherscan API error: ${data.message}`);
  }

  // Balance is returned in Wei, convert to Ether
  const balanceInWei = BigInt(data.result);
  const balanceInEth = Number(balanceInWei) / 1e18;

  return {
    balance: balanceInEth
  };
}

// --- Mempool Data ---

export async function fetchMempool(): Promise<{ txs: MempoolTx[]; feeRates: { low: number; medium: number; high: number } }> {
  const url = `${BLOCKSTREAM_API}/mempool`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Blockstream Mempool API error: ${response.status}`);
  }

  const data = await response.json();

  // Blockstream mempool endpoint returns general stats, not a list of txs.
  // We'll use the fee-estimates endpoint for fee rates and mock the txs list.
  const feeUrl = `${BLOCKSTREAM_API}/fee-estimates`;
  const feeResponse = await fetch(feeUrl);
  const feeData = await feeResponse.json();

  const feeRates = {
    low: feeData["144"] || 1, // 24 hours
    medium: feeData["30"] || 5, // 5 hours
    high: feeData["2"] || 10, // 2 blocks
  };

  // Mocking txs list as Blockstream mempool endpoint doesn't provide it easily
  const txs: MempoolTx[] = [];

  return {
    txs: txs,
    feeRates: feeRates
  };
}

// --- Block Data ---

export async function fetchBlock(heightOrHash: string): Promise<BlockData> {
  let hash: string;

  if (isNaN(Number(heightOrHash))) {
    hash = heightOrHash;
  } else {
    const hashUrl = `${BLOCKSTREAM_API}/block-height/${heightOrHash}`;
    const hashResponse = await fetch(hashUrl);
    if (!hashResponse.ok) {
      throw new Error(`Blockstream Block Hash API error: ${hashResponse.status}`);
    }
    hash = await hashResponse.text();
  }

  const blockUrl = `${BLOCKSTREAM_API}/block/${hash}`;
  const blockResponse = await fetch(blockUrl);
  if (!blockResponse.ok) {
    throw new Error(`Blockstream Block API error: ${blockResponse.status}`);
  }
  const blockData = await blockResponse.json();

  const txsUrl = `${BLOCKSTREAM_API}/block/${hash}/txs`;
  const txsResponse = await fetch(txsUrl);
  if (!txsResponse.ok) {
    throw new Error(`Blockstream Block Txs API error: ${txsResponse.status}`);
  }
  const txsData = await txsResponse.json();

  return {
    height: blockData.height,
    hash: blockData.id,
    time: blockData.timestamp,
    txCount: blockData.tx_count,
    size: blockData.size,
    weight: blockData.weight,
    fee: txsData.reduce((sum: number, tx: any) => sum + tx.fee, 0),
    miner: "Unknown", // Blockstream API does not provide miner info easily
    txs: txsData.map((tx: any) => ({
      hash: tx.txid,
      fee: tx.fee,
      size: tx.size,
      value: tx.vout.reduce((sum: number, output: any) => sum + output.value, 0)
    }))
  };
}
