
// Mock Crypto Utils for Prototype

export interface Transaction {
  hash: string;
  time: number;
  result: number;
  out: { value: number, addr: string }[];
}

export interface DerivedIdentity {
  txId: string;
  privateKey: string; // The TxID acts as the private key in this experiment
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

// Simulate fetching transactions
export async function fetchTransactions(address: string): Promise<Transaction[]> {
  try {
    // Attempt real fetch first
    const response = await fetch(`https://blockchain.info/rawaddr/${address}?cors=true`);
    if (response.ok) {
      const data = await response.json();
      return data.txs.map((tx: any) => ({
        hash: tx.hash,
        time: tx.time,
        result: tx.result,
        out: tx.out
      }));
    }
    throw new Error("API Limit or Blocked");
  } catch (e) {
    console.warn("Falling back to mock data", e);
    // Mock data fallback
    return Array.from({ length: 15 }).map((_, i) => ({
      hash: generateRandomHex(64),
      time: Date.now() / 1000 - i * 3600,
      result: Math.random() > 0.5 ? 0 : -100000,
      out: [{ value: 50000, addr: address }]
    }));
  }
}

// Pseudo-crypto functions (Mocking the derivation for stability in browser)
export function txToPrivate(txId: string): string {
  // In this experiment, the TxID IS the private key
  return txId;
}

export function privateToWif(privateKey: string): string {
  // Mock WIF format: 5... (Base58-like)
  // Real WIF conversion requires SHA256 and Base58Check
  // We will simulate it deterministically based on the input
  const prefix = "5"; 
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let res = prefix;
  for (let i = 0; i < 50; i++) {
    res += chars[parseInt(privateKey.substr(i % 60, 2), 16) % 58];
  }
  return res;
}

export function privateToEthAddress(privateKey: string): string {
  // Mock ETH address: 0x...
  const chars = "0123456789abcdef";
  let res = "0x";
  for (let i = 0; i < 40; i++) {
    res += chars[parseInt(privateKey.substr(i % 60, 2), 16) % 16];
  }
  return res;
}

export function wifToBtcAddresses(wif: string) {
  // Mock BTC addresses based on WIF
  const seed = wif.substring(5, 10);
  return {
    legacy: `1${seed}MockLegacyAddress${Math.floor(Math.random() * 1000)}`,
    segwit: `3${seed}MockSegwitAddress${Math.floor(Math.random() * 1000)}`,
    bech32: `bc1${seed.toLowerCase()}mockbech32${Math.floor(Math.random() * 1000)}`
  };
}

export async function checkBalance(address: string, coin: 'ETH' | 'BTC'): Promise<number> {
  // Mock balance check
  await new Promise(resolve => setTimeout(resolve, 500));
  // 10% chance of finding a balance
  return Math.random() > 0.9 ? Math.random() * 0.5 : 0;
}

export function generateRandomHex(length: number): string {
  const chars = "0123456789abcdef";
  let res = "";
  for (let i = 0; i < length; i++) {
    res += chars[Math.floor(Math.random() * 16)];
  }
  return res;
}
