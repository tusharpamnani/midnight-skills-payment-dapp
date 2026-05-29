'use client';

import { ContractState, sampleSigningKey } from '@midnight-ntwrk/compact-runtime';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  createUnprovenDeployTx,
  submitTxAsync,
  submitCallTxAsync,
} from '@midnight-ntwrk/midnight-js-contracts';
import { encodeUserAddress } from '@midnight-ntwrk/ledger-v8';
import { Payment } from '@contract/index';

import type { ConnectedSession } from './midnight';
import { fromHex, fetchContractState } from './midnight';

const DEPOSIT_CIRCUIT = 'deposit';
const WITHDRAW_CIRCUIT = 'withdraw';
const ZK_ASSET_PATH = '/zk/payment/';
const PRIVATE_STATE_ID = 'paymentPrivateState';

export function generateOwnerKey(): Uint8Array {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

function makeCompiledContract() {
  const witnesses = {
    ownerKey: (context: any) => [context.privateState, context.privateState.ownerSecretKey],
  };

  return CompiledContract.make('payment', Payment.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_ASSET_PATH),
  ) as any;
}

export function decodePaymentState(stateHex: string): {
  balance: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
} {
  const contractState = ContractState.deserialize(fromHex(stateHex));
  const ledger = Payment.ledger(contractState.data);
  return {
    balance: ledger.balance as unknown as bigint,
    totalDeposited: ledger.totalDeposited as unknown as bigint,
    totalWithdrawn: ledger.totalWithdrawn as unknown as bigint,
  };
}

export async function getPaymentState(
  session: ConnectedSession,
  contractAddress: string,
): Promise<{ balance: bigint; totalDeposited: bigint; totalWithdrawn: bigint } | null> {
  try {
    const state = await fetchContractState(session.config.indexerUri, contractAddress);
    if (!state) return null;
    return decodePaymentState(state);
  } catch (e) {
    console.error('Failed to query payment state:', e);
    return null;
  }
}

export async function deployPayment(
  session: ConnectedSession,
  ownerKey: Uint8Array,
): Promise<string> {
  const compiledContract = makeCompiledContract();
  const initialPrivateState = { ownerSecretKey: ownerKey };

  const deployTxData = await (createUnprovenDeployTx as any)(
    { zkConfigProvider: session.providers.zkConfigProvider, walletProvider: session.providers.walletProvider },
    { compiledContract, args: [], privateStateId: PRIVATE_STATE_ID, initialPrivateState, signingKey: sampleSigningKey() },
  );

  const contractAddress = deployTxData.public.contractAddress;

  await (submitTxAsync as any)(session.providers, { unprovenTx: deployTxData.private.unprovenTx });

  await session.providers.privateStateProvider.setContractAddress(contractAddress);
  await session.providers.privateStateProvider.set(PRIVATE_STATE_ID, initialPrivateState);
  await session.providers.privateStateProvider.setSigningKey(contractAddress, deployTxData.private.signingKey);

  return contractAddress;
}

export async function depositPayment(
  session: ConnectedSession,
  contractAddress: string,
  amount: bigint,
): Promise<void> {
  const compiledContract = makeCompiledContract();

  await (submitCallTxAsync as any)(session.providers, {
    compiledContract,
    contractAddress,
    circuitId: DEPOSIT_CIRCUIT,
    args: [amount],
    privateStateId: PRIVATE_STATE_ID,
  });
}

export async function withdrawPayment(
  session: ConnectedSession,
  contractAddress: string,
  amount: bigint,
  recipientAddress: string,
): Promise<void> {
  const compiledContract = makeCompiledContract();

  await (submitCallTxAsync as any)(session.providers, {
    compiledContract,
    contractAddress,
    circuitId: WITHDRAW_CIRCUIT,
    args: [amount, { bytes: encodeUserAddress(recipientAddress) }],
    privateStateId: PRIVATE_STATE_ID,
  });
}


