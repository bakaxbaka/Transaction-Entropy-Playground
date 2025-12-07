import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import createKeccakHash from 'keccak';
import bs58check from 'bs58check';

function keccak256(data: Buffer): Buffer {
  return createKeccakHash('keccak256').update(data).digest();
}

bitcoin.initEccLib(ecc);

const SECP256K1_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

export interface SyntheticIdentity {
  sourceTxId: string;
  privateKeyHex: string;
  wif: string;
  ethAddress: string;
  btcLegacy: string;
  btcSegwit: string;
  btcBech32: string;
}

export function txidToPrivateKey(txid: string): Buffer {
  const cleanTxid = txid.replace(/^0x/, '').toLowerCase();
  
  if (!/^[0-9a-f]{64}$/.test(cleanTxid)) {
    throw new Error('Invalid TXID format - must be 64 hex characters');
  }
  
  let entropy = BigInt('0x' + cleanTxid);
  entropy = entropy % SECP256K1_ORDER;
  if (entropy === BigInt(0)) {
    entropy = BigInt(1);
  }
  
  const hexKey = entropy.toString(16).padStart(64, '0');
  return Buffer.from(hexKey, 'hex');
}

export function privateKeyToWIF(privateKey: Buffer, compressed = true): string {
  const version = Buffer.from([0x80]);
  let payload = Buffer.concat([version, privateKey]);
  
  if (compressed) {
    payload = Buffer.concat([payload, Buffer.from([0x01])]);
  }
  
  return bs58check.encode(payload);
}

export function privateKeyToEthAddress(privateKey: Buffer): string {
  const publicKey = Buffer.from(ecc.pointFromScalar(privateKey, false)!);
  const publicKeyWithoutPrefix = publicKey.slice(1);
  const hash = keccak256(publicKeyWithoutPrefix);
  const address = '0x' + Buffer.from(hash).slice(-20).toString('hex');
  return toChecksumAddress(address);
}

function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = Buffer.from(keccak256(Buffer.from(addr))).toString('hex');
  
  let checksummed = '0x';
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksummed += addr[i].toUpperCase();
    } else {
      checksummed += addr[i];
    }
  }
  return checksummed;
}

export function privateKeyToBtcAddresses(privateKey: Buffer): { legacy: string; segwit: string; bech32: string } {
  const keyPair = {
    publicKey: Buffer.from(ecc.pointFromScalar(privateKey, true)!),
    privateKey: privateKey
  };
  
  const { address: legacy } = bitcoin.payments.p2pkh({ 
    pubkey: keyPair.publicKey,
    network: bitcoin.networks.bitcoin 
  });
  
  const { address: segwit } = bitcoin.payments.p2sh({
    redeem: bitcoin.payments.p2wpkh({ 
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.bitcoin 
    }),
    network: bitcoin.networks.bitcoin
  });
  
  const { address: bech32 } = bitcoin.payments.p2wpkh({ 
    pubkey: keyPair.publicKey,
    network: bitcoin.networks.bitcoin 
  });
  
  return {
    legacy: legacy || '',
    segwit: segwit || '',
    bech32: bech32 || ''
  };
}

export function deriveSyntheticIdentity(txid: string): SyntheticIdentity {
  const privateKey = txidToPrivateKey(txid);
  const wif = privateKeyToWIF(privateKey);
  const ethAddress = privateKeyToEthAddress(privateKey);
  const btcAddresses = privateKeyToBtcAddresses(privateKey);
  
  return {
    sourceTxId: txid,
    privateKeyHex: privateKey.toString('hex'),
    wif,
    ethAddress,
    btcLegacy: btcAddresses.legacy,
    btcSegwit: btcAddresses.segwit,
    btcBech32: btcAddresses.bech32
  };
}

export function deriveBatch(txids: string[]): SyntheticIdentity[] {
  return txids.map(txid => {
    try {
      return deriveSyntheticIdentity(txid);
    } catch (error) {
      console.error(`Failed to derive from txid ${txid}:`, error);
      return null;
    }
  }).filter((identity): identity is SyntheticIdentity => identity !== null);
}
