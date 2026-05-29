'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Wallet,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Loader2,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { detectWallet, createConnectedSession, pollForState } from '@/lib/midnight';
import {
  deployPayment,
  depositPayment,
  withdrawPayment,
  getPaymentState,
  decodePaymentState,
  generateOwnerKey,
} from '@/lib/payment';
import type { ConnectedSession } from '@/lib/midnight';

function truncateAddress(addr: string, chars = 4) {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

type ActionTab = 'deposit' | 'withdraw';

export default function PaymentClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [ownerKey, setOwnerKey] = useState<Uint8Array | null>(null);
  const [contractAddress, setContractAddress] = useState('');
  const [balance, setBalance] = useState<bigint | null>(null);
  const [totalDeposited, setTotalDeposited] = useState<bigint | null>(null);
  const [totalWithdrawn, setTotalWithdrawn] = useState<bigint | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionTab, setActionTab] = useState<ActionTab>('deposit');
  const mountedRef = useRef(true);

  useEffect(() => {
    detectWallet().then((w) => setWalletInstalled(w !== null));
    return () => { mountedRef.current = false; };
  }, []);

  const withLoading = useCallback(async <T,>(
    message: string,
    fn: (setStatus: (msg: string) => void) => Promise<T>,
  ): Promise<T> => {
    setBusy(true);
    setError('');
    setStatusMessage(message);
    try {
      const result = await fn((msg: string) => {
        if (mountedRef.current) setStatusMessage(msg);
      });
      return result;
    } catch (e) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : String(e));
      }
      throw e;
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setStatusMessage('');
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setConnecting(true);
    setError('');
    try {
      const wallet = await detectWallet();
      if (!wallet) {
        setError('1AM wallet not detected. Please install the 1AM browser extension.');
        return;
      }
      const api = await wallet.connect('preprod');
      const s = await createConnectedSession(api, '/zk/payment/');
      setSession(s);
      setOwnerKey(generateOwnerKey());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  }, []);

  const refreshState = useCallback(async () => {
    if (!session || !contractAddress) return;
    setError('');
    try {
      const state = await getPaymentState(session, contractAddress);
      if (state) {
        setBalance(state.balance);
        setTotalDeposited(state.totalDeposited);
        setTotalWithdrawn(state.totalWithdrawn);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch state');
    }
  }, [session, contractAddress]);

  const handleDeploy = useCallback(async () => {
    if (!session || !ownerKey) return;
    await withLoading('Deploying payment contract…', async (setStatus) => {
      const addr = await deployPayment(session, ownerKey);
      setContractAddress(addr);

      setStatus('Waiting for indexer…');
      await pollForState(
        session.config.indexerUri,
        addr,
        (attempt) => setStatus(`Waiting for indexer (attempt ${attempt})…`),
      );

      const state = decodePaymentState(
        await pollForState(
          session.config.indexerUri,
          addr,
          (attempt) => setStatus(`Reading contract state (attempt ${attempt})…`),
        ),
      );
      setBalance(state.balance);
      setTotalDeposited(state.totalDeposited);
      setTotalWithdrawn(state.totalWithdrawn);
    });
  }, [session, ownerKey, withLoading]);

  const handleDeposit = useCallback(async () => {
    if (!session || !contractAddress || !depositAmount) return;
    const amount = BigInt(depositAmount);
    await withLoading('Depositing tNIGHT + proving circuit…', async (setStatus) => {
      await depositPayment(session, contractAddress, amount);

      setStatus('Waiting for indexer…');
      await pollForState(
        session.config.indexerUri,
        contractAddress,
        (attempt) => setStatus(`Waiting for indexer (attempt ${attempt})…`),
      );

      const state = decodePaymentState(
        await pollForState(
          session.config.indexerUri,
          contractAddress,
          (attempt) => setStatus(`Reading updated state (attempt ${attempt})…`),
        ),
      );
      setBalance(state.balance);
      setTotalDeposited(state.totalDeposited);
      setTotalWithdrawn(state.totalWithdrawn);
    });
  }, [session, contractAddress, depositAmount, withLoading]);

  const handleWithdraw = useCallback(async () => {
    if (!session || !contractAddress || !withdrawAmount) return;
    const amount = BigInt(withdrawAmount);
    await withLoading('Processing withdrawal (proving + submitting)…', async (setStatus) => {
      await withdrawPayment(session, contractAddress, amount, session.coinPublicKeyBytes);

      setStatus('Waiting for indexer…');
      await pollForState(
        session.config.indexerUri,
        contractAddress,
        (attempt) => setStatus(`Waiting for indexer (attempt ${attempt})…`),
      );

      const state = decodePaymentState(
        await pollForState(
          session.config.indexerUri,
          contractAddress,
          (attempt) => setStatus(`Reading updated state (attempt ${attempt})…`),
        ),
      );
      setBalance(state.balance);
      setTotalDeposited(state.totalDeposited);
      setTotalWithdrawn(state.totalWithdrawn);
    });
  }, [session, contractAddress, withdrawAmount, withLoading]);

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(contractAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [contractAddress]);

  const reset = useCallback(() => {
    setContractAddress('');
    setBalance(null);
    setTotalDeposited(null);
    setTotalWithdrawn(null);
    setError('');
  }, []);

  const isWaitingIndexer = busy && statusMessage.startsWith('Waiting');

  /* ── Blocking states: no wallet / no session ── */

  if (walletInstalled === false) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
          <Wallet className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <h2 className="text-xl font-semibold text-foreground">1AM Wallet Required</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
          Install the 1AM browser extension for Midnight Network to continue.
        </p>
        <div className="mt-8">
          <a
            href="https://1am.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Install 1AM Wallet
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    );
  }

  if (walletInstalled === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:py-12">
      {/* ── Header ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            Midnight Network
          </p>
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Payment DApp
          </h1>
        </div>
        {session && (
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {session.config.networkId}
          </span>
        )}
      </div>

      {/* ── Not connected ── */}
      {!session && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted ring-1 ring-border">
            <Wallet className="h-8 w-8 text-muted-foreground" aria-hidden />
          </div>
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-primary px-10 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {connecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span>Connecting…</span>
              </>
            ) : (
              <>
                <Wallet className="h-4 w-4" aria-hidden />
                <span>Connect 1AM Wallet</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Dashboard ── */}
      {session && (
        <div className="md:grid md:grid-cols-[260px_1fr] md:gap-6">
          {/* ═══════ SIDEBAR ═══════ */}
          <div className="space-y-4 mb-6 md:mb-0">
            {/* ── Wallet Pill ── */}
            {session && (
              <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:translate-y-[-1px]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                    <Wallet className="h-[18px] w-[18px]" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">Wallet connected</p>
                    <p className="font-mono text-xs text-muted-foreground truncate">
                      {truncateAddress(session.unshieldedAddress)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Contract Address (compact) ── */}
            {contractAddress && (
              <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:translate-y-[-1px]">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em] mb-2">
                  Contract
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate font-mono text-xs text-foreground">
                    {contractAddress}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={copied ? 'Copied' : 'Copy address'}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Deploy (sidebar) ── */}
            {!contractAddress && !busy && (
              <div className="rounded-xl border bg-card p-4">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em] mb-3">
                  No Contract
                </p>
                <button
                  onClick={handleDeploy}
                  className="inline-flex w-full h-10 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/30 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Deploy Contract
                </button>
                <p className="mt-2 text-[11px] text-muted-foreground/60 leading-relaxed">
                  1AM sponsors all network fees.
                </p>
              </div>
            )}

            {!contractAddress && busy && (
              <div className="rounded-xl border bg-card p-4 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground/60" aria-label="Deploying" />
                <p className="mt-2 text-xs text-foreground font-medium">Deploying</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/60">{statusMessage}</p>
              </div>
            )}

            {/* ── Sidebar Footer ── */}
            {contractAddress && (
              <div className="pt-2 space-y-1.5">
                <button
                  onClick={refreshState}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground/60 transition-all hover:text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Refresh state
                </button>
                <button
                  onClick={reset}
                  disabled={busy}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground/60 transition-all hover:text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span aria-hidden>+</span>
                  New contract
                </button>
              </div>
            )}
          </div>

          {/* ═══════ MAIN PANEL ═══════ */}
          {contractAddress && (
            <div className="space-y-5">
              {/* ── Balance Hero ── */}
              <div className="rounded-2xl border bg-card p-6 md:p-8 text-center transition-all hover:shadow-lg hover:translate-y-[-2px]">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
                  Balance
                </p>
                <p
                  className="mt-3 text-5xl font-bold tracking-tight tabular-nums md:text-6xl"
                  style={{
                    color: 'var(--foreground)',
                    textShadow: '0 0 40px color-mix(in oklch, var(--primary) 15%, transparent), 0 0 80px color-mix(in oklch, var(--primary) 8%, transparent)',
                  }}
                >
                  {balance !== null ? Number(balance).toLocaleString() : (
                    <span className="text-2xl text-muted-foreground">—</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">tNIGHT</p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  {totalDeposited !== null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-emerald-500/5 px-3 py-1 text-xs text-muted-foreground">
                      <span className="text-emerald-500 font-medium tabular-nums">+{Number(totalDeposited).toLocaleString()}</span>
                      <span className="text-muted-foreground/50">deposited</span>
                    </span>
                  )}
                  {totalWithdrawn !== null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-destructive/5 px-3 py-1 text-xs text-muted-foreground">
                      <span className="text-destructive font-medium tabular-nums">-{Number(totalWithdrawn).toLocaleString()}</span>
                      <span className="text-muted-foreground/50">withdrawn</span>
                    </span>
                  )}
                </div>
              </div>

              {/* ── Segmented Toggle ── */}
              <div className="flex rounded-xl bg-muted p-1 w-fit">
                <button
                  onClick={() => setActionTab('deposit')}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    actionTab === 'deposit'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ArrowUp className="h-4 w-4 text-emerald-500" aria-hidden />
                  Deposit
                </button>
                <button
                  onClick={() => setActionTab('withdraw')}
                  className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    actionTab === 'withdraw'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ArrowDown className="h-4 w-4 text-destructive" aria-hidden />
                  Withdraw
                </button>
              </div>

              {/* ── Active Action Panel ── */}
              {actionTab === 'deposit' ? (
                <div className="rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:translate-y-[-2px]">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em] mb-4">
                    Deposit tNIGHT
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      id="deposit-amount"
                      type="text"
                      inputMode="numeric"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Amount in Stars"
                      className="flex-1 h-11 px-4 text-sm font-mono rounded-xl border bg-background text-foreground placeholder:text-muted-foreground/40 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
                      aria-label="Deposit amount in Stars"
                    />
                    <button
                      onClick={handleDeposit}
                      disabled={busy || !depositAmount}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <ArrowUp className="h-4 w-4" aria-hidden />
                      )}
                      {isWaitingIndexer ? (
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-primary-foreground/60 animate-pulse" />
                          Indexing…
                        </span>
                      ) : (
                        <span>{busy ? 'Processing…' : 'Deposit'}</span>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground/60 leading-relaxed">
                    1 tNIGHT = 1,000,000 Stars. Sends tNIGHT + updates ledger in one tx.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:translate-y-[-2px]">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em] mb-4">
                    Withdraw (Owner Only)
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      id="withdraw-amount"
                      type="text"
                      inputMode="numeric"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Amount in Stars"
                      className="flex-1 h-11 px-4 text-sm font-mono rounded-xl border bg-background text-foreground placeholder:text-muted-foreground/40 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent"
                      aria-label="Withdraw amount in Stars"
                    />
                    <button
                      onClick={handleWithdraw}
                      disabled={busy || !withdrawAmount}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-destructive px-6 text-sm font-medium text-destructive-foreground shadow-lg shadow-destructive/20 transition-all hover:shadow-xl hover:shadow-destructive/30 hover:opacity-90 active:scale-[0.97] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <ArrowDown className="h-4 w-4" aria-hidden />
                      )}
                      {isWaitingIndexer ? (
                        <span className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-destructive-foreground/60 animate-pulse" />
                          Indexing…
                        </span>
                      ) : (
                        <span>{busy ? 'Processing…' : 'Withdraw'}</span>
                      )}
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground/60 leading-relaxed">
                    Owner only. Sends tNIGHT to your unshielded wallet + updates ledger in one tx.
                  </p>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.03] p-4 transition-all hover:shadow-md mt-6">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <AlertCircle className="h-4 w-4 text-destructive" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">Transaction failed</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
