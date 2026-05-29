import Link from "next/link";
import { Wallet, ArrowRight, ExternalLink, Send, Activity } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-4 py-20 md:py-28">
      <main className="flex max-w-2xl flex-col items-center text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em]">
            Midnight Network
          </span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
          Midnight Payment DApp
        </h1>

        <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
          Privacy-preserving smart contracts on Midnight Network.
          Deploy, transact, and query state &mdash; all with zero gas fees via
          the 1AM wallet.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <Link
            href="/payment"
            className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Wallet className="h-4 w-4" aria-hidden />
            Payment DApp
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a
            href="https://docs.midnight.network"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full border bg-background px-8 text-sm font-medium text-foreground transition-all hover:bg-muted hover:shadow-md active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Midnight Docs
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>

        <div className="mt-20 grid gap-6 text-left sm:grid-cols-3">
          <div className="group rounded-xl border bg-card p-6 transition-all hover:translate-y-[-2px] hover:shadow-lg hover:border-primary/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Wallet className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-sm font-semibold text-foreground">1. Connect Wallet</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Use the 1AM browser extension to connect to Midnight.
            </p>
          </div>

          <div className="group rounded-xl border bg-card p-6 transition-all hover:translate-y-[-2px] hover:shadow-lg hover:border-primary/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Send className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-sm font-semibold text-foreground">2. Deploy Contract</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Deploy a payment contract. 1AM sponsors all fees.
            </p>
          </div>

          <div className="group rounded-xl border bg-card p-6 transition-all hover:translate-y-[-2px] hover:shadow-lg hover:border-primary/20">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
              <Activity className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-sm font-semibold text-foreground">3. Transact &amp; Query</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Send tNIGHT, call circuits, and read on-chain state.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
