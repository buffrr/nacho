import { Transaction, SigHash } from "@scure/btc-signer";
import { schnorr } from "@noble/secp256k1";
import { hexToBytes } from "@noble/hashes/utils.js";

// Generic SIGHASH_SINGLE|ANYONECANPAY signer for handle transactions (transfer,
// sale, cancel, rotate). Signs ONE owned input committing to ONE output; the
// counterparty appends their own inputs/outputs and broadcasts. The handle key
// IS the taproot output key in `5120<xonly>` (untweaked), so we compute the
// BIP-341 sighash with @scure/btc-signer and set an untweaked BIP-340 schnorr
// signature as tapKeySig (btc-signer's own signer would apply the taproot tweak).
//
// Ownership move vs sale is expressed purely by the value relation:
//   output.amount == input.amount        → the handle relocates to output.script
//   output.amount == input.amount+price  → a sale (buyer funds the difference)
// This module doesn't care which — the caller sets output.amount accordingly.

export type SignInput = {
  txid: string; // display-order hex
  vout: number;
  amount: number; // sats — committed by the sighash (self-checking)
  script: string; // hex spk; must be an owned handle's 5120<xonly>
};
export type SignOutput = { amount: number; script: string };

const SIGHASH = SigHash.SINGLE_ANYONECANPAY; // 0x83

export function signSingleAnyonecanpay(
  input: SignInput,
  output: SignOutput,
  privkeyHex: string,
  opts?: { version?: number; lockTime?: number },
): string {
  const tx = new Transaction({
    version: opts?.version ?? 2,
    lockTime: opts?.lockTime ?? 0,
    allowUnknownOutputs: true,
    allowUnknownInputs: true,
  });

  tx.addInput({
    txid: hexToBytes(input.txid),
    index: input.vout,
    witnessUtxo: { script: hexToBytes(input.script), amount: BigInt(input.amount) },
    sighashType: SIGHASH,
  });
  tx.addOutput({ script: hexToBytes(output.script), amount: BigInt(output.amount) });

  const digest = tx.preimageWitnessV1(
    0,
    [hexToBytes(input.script)],
    SIGHASH,
    [BigInt(input.amount)],
  );
  const sig = schnorr.sign(digest, hexToBytes(privkeyHex)); // 64 bytes, untweaked
  const tapKeySig = new Uint8Array(65);
  tapKeySig.set(sig, 0);
  tapKeySig[64] = SIGHASH; // non-default sighash byte (BIP-341)
  tx.updateInput(0, { tapKeySig }, true);

  return Buffer.from(tx.toPSBT()).toString("base64");
}
