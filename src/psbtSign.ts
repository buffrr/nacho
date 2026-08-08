import { Transaction, SigHash } from "@scure/btc-signer";
import { schnorr } from "@noble/secp256k1";
import { hexToBytes } from "@noble/hashes/utils.js";
import type { PsbtRequest } from "@/signRequest";

// Signs the OUR-owned inputs of a PSBT request with SIGHASH_SINGLE|ANYONECANPAY
// and returns a base64 PSBT for the counterparty to combine. The handle key IS
// the taproot output key in `5120<xonly>` (untweaked), so we compute the BIP-341
// sighash with @scure/btc-signer and sign it with a plain BIP-340 schnorr
// signature (no taproot tweak) — btc-signer's own signer would tweak, so we set
// the key-path signature (tapKeySig) manually instead.

export type OwnedInputKey = { handle: string; privkeyHex: string };
// Given an input's scriptPubKey (hex), return the owning handle + its key, or
// null if the input isn't one of ours (we refuse to sign those).
export type ResolveOwnedKey = (script: string) => Promise<OwnedInputKey | null>;

export type SignedInputInfo = {
  handle: string;
  inAmount: number;
  inScript: string;
  outAmount: number;
  outScript: string;
};
export type PsbtSignResult = { psbtBase64: string; inputs: SignedInputInfo[] };

const SIGHASH = SigHash.SINGLE_ANYONECANPAY; // 0x83

export async function signPsbtRequest(
  req: PsbtRequest,
  resolveOwnedKey: ResolveOwnedKey,
): Promise<PsbtSignResult> {
  // Resolve every key first, so we bail before building anything if any input
  // isn't ours (never sign a caller-supplied key).
  const keys: OwnedInputKey[] = [];
  for (let i = 0; i < req.sign.length; i++) {
    const owned = await resolveOwnedKey(req.sign[i].script);
    if (!owned) {
      throw new Error(`Input ${i + 1} isn't one of your handles — refusing to sign.`);
    }
    keys.push(owned);
  }

  const tx = new Transaction({
    version: req.version ?? 2,
    lockTime: req.locktime ?? 0,
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
  });

  for (const inp of req.sign) {
    tx.addInput({
      txid: hexToBytes(inp.txid),
      index: inp.vout,
      witnessUtxo: { script: hexToBytes(inp.script), amount: BigInt(inp.amount) },
      sighashType: SIGHASH,
    });
  }
  for (const out of req.outputs) {
    tx.addOutput({ script: hexToBytes(out.script), amount: BigInt(out.amount) });
  }

  // BIP-341 commits to all inputs' prevout scripts/amounts (ANYONECANPAY uses
  // only index i, but the API indexes into these arrays).
  const prevScripts = req.sign.map((s) => hexToBytes(s.script));
  const amounts = req.sign.map((s) => BigInt(s.amount));

  const inputs: SignedInputInfo[] = [];
  for (let i = 0; i < req.sign.length; i++) {
    const digest = tx.preimageWitnessV1(i, prevScripts, SIGHASH, amounts);
    const sig = schnorr.sign(digest, hexToBytes(keys[i].privkeyHex)); // 64 bytes
    const tapKeySig = new Uint8Array(65);
    tapKeySig.set(sig, 0);
    tapKeySig[64] = SIGHASH; // non-default sighash → append the byte (BIP-341)
    tx.updateInput(i, { tapKeySig }, true);
    inputs.push({
      handle: keys[i].handle,
      inAmount: req.sign[i].amount,
      inScript: req.sign[i].script,
      outAmount: req.outputs[i].amount,
      outScript: req.outputs[i].script,
    });
  }

  const psbtBase64 = Buffer.from(tx.toPSBT()).toString("base64");
  return { psbtBase64, inputs };
}
