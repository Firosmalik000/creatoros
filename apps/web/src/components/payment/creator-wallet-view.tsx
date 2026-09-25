"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import type {
  CreatorWallet,
  Currency,
  LedgerEntry,
  PayoutMethod,
  PayoutRequest,
} from "@/lib/payment-types";
import {
  savePayoutMethod,
  requestPayout,
  getPayoutMethods,
} from "@/lib/payment-client";

type Props = {
  wallet: CreatorWallet;
  ledger: LedgerEntry[];
  payoutMethods: PayoutMethod[];
  payouts: PayoutRequest[];
  locale: string;
  labels: {
    title: string;
    available: string;
    escrow: string;
    totalWithdrawn: string;
    ledger: string;
    noLedger: string;
    payoutMethods: string;
    addPayoutMethod: string;
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    payoutType: string;
    bankTransfer: string;
    eWallet: string;
    default: string;
    addMethod: string;
    adding: string;
    methodAdded: string;
    methodError: string;
    requestPayout: string;
    payoutAmount: string;
    payoutCurrency: string;
    requestingPayout: string;
    payoutSuccess: string;
    payoutError: string;
    minimumAmount: string;
    insufficientBalance: string;
    payoutHistory: string;
    noPayouts: string;
    payoutStatus: {
      pending: string;
      processing: string;
      completed: string;
      rejected: string;
    };
  };
};

function formatMinor(minor: number, currency: string, locale: string): string {
  const divisor = currency === "IDR" ? 1 : 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(minor / divisor);
}

export function CreatorWalletView({
  wallet: initialWallet,
  ledger: initialLedger,
  payoutMethods: initialMethods,
  payouts: initialPayouts,
  locale,
  labels,
}: Props) {
  const [wallet, setWallet] = useState(initialWallet);
  const [ledger] = useState(initialLedger);
  const [methods, setMethods] = useState(initialMethods);
  const [payouts, setPayouts] = useState(initialPayouts);

  // Modals state
  const [isAddMethodOpen, setIsAddMethodOpen] = useState(false);
  const [addingMethod, setAddingMethod] = useState(false);
  const [methodSuccess, setMethodSuccess] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);
  const [methodForm, setMethodForm] = useState({
    payout_type: "bank_transfer" as "bank_transfer" | "e_wallet",
    bank_name: "",
    account_number: "",
    account_holder_name: "",
  });

  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutForm, setPayoutForm] = useState({
    amount_minor: "",
    currency: initialWallet.currency as Currency,
    payout_method_id: initialMethods.find((m) => m.is_default)?.id ?? initialMethods[0]?.id ?? "",
  });

  async function handleAddMethod(e: React.FormEvent) {
    e.preventDefault();
    setAddingMethod(true);
    setMethodError(null);
    setMethodSuccess(null);
    try {
      const added = await savePayoutMethod(methodForm);
      setMethods((prev) => [added, ...prev]);
      setMethodSuccess(labels.methodAdded);
      setIsAddMethodOpen(false);
      setMethodForm({
        payout_type: "bank_transfer",
        bank_name: "",
        account_number: "",
        account_holder_name: "",
      });
      const freshMethods = await getPayoutMethods();
      setMethods(freshMethods);
    } catch {
      setMethodError(labels.methodError);
    } finally {
      setAddingMethod(false);
    }
  }

  async function handleRequestPayout(e: React.FormEvent) {
    e.preventDefault();
    setRequestingPayout(true);
    setPayoutError(null);
    setPayoutSuccess(null);

    const amountNum = Number(payoutForm.amount_minor);
    const divisor = payoutForm.currency === "IDR" ? 1 : 100;
    const amountMinor = Math.round(amountNum * divisor);

    if (amountMinor > wallet.available_balance_minor) {
      setPayoutError(labels.insufficientBalance);
      setRequestingPayout(false);
      return;
    }

    try {
      const created = await requestPayout({
        amount_minor: amountMinor,
        currency: payoutForm.currency,
        payout_method_id: payoutForm.payout_method_id,
      });

      setPayouts((prev) => [created, ...prev]);
      setWallet((w) => ({
        ...w,
        available_balance_minor: w.available_balance_minor - amountMinor,
      }));
      setPayoutSuccess(labels.payoutSuccess);
      setIsPayoutOpen(false);
      setPayoutForm((f) => ({ ...f, amount_minor: "" }));
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      setPayoutError(errObj.message || labels.payoutError);
    } finally {
      setRequestingPayout(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Notifications */}
      {payoutSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{payoutSuccess}</span>
        </div>
      )}
      {payoutError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{payoutError}</span>
        </div>
      )}
      {methodSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{methodSuccess}</span>
        </div>
      )}

      {/* Top Section: Balance Cards + Payout Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#0e1424] border border-blue-500/40 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              {labels.available}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Wallet size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
              {formatMinor(wallet.available_balance_minor, wallet.currency, locale)}
            </div>
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                setPayoutError(null);
                setIsPayoutOpen(true);
              }}
              disabled={wallet.available_balance_minor <= 0}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all disabled:opacity-50 min-h-[44px]"
            >
              {labels.requestPayout}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {labels.escrow}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <CreditCard size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-200 font-mono">
              {formatMinor(wallet.escrow_balance_minor, wallet.currency, locale)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Held safely in active milestones</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-sm flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {labels.totalWithdrawn}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-200 font-mono">
              {formatMinor(wallet.total_withdrawn_minor, wallet.currency, locale)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Completed lifetime withdrawals</p>
          </div>
        </div>
      </div>

      {/* Payout Methods Section */}
      <div className="bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/90 dark:border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{labels.payoutMethods}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Where your earnings will be transferred</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMethodError(null);
              setIsAddMethodOpen(true);
            }}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 transition-colors self-start sm:self-auto min-h-[44px]"
          >
            <Plus size={14} />
            <span>{labels.addPayoutMethod}</span>
          </button>
        </div>

        {methods.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
            {labels.addPayoutMethod}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {methods.map((m) => (
              <div
                key={m.id}
                className="bg-slate-50 dark:bg-[#131b2e] border border-slate-200/90 dark:border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{m.bank_name}</span>
                  {m.is_default && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                      {labels.default}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
                    •••• {m.account_number.slice(-4)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {m.account_holder_name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger Transactions & History Tabs/Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ledger */}
        <div className="bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200/90 dark:border-white/10 pb-3">
            {labels.ledger}
          </h2>
          {ledger.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm py-6 text-center">{labels.noLedger}</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#131b2e] border border-slate-200/80 dark:border-white/5 text-sm transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        entry.entry_type === "credit"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {entry.entry_type === "credit" ? "+" : "−"}
                    </span>
                    <div>
                      <div className="text-slate-900 dark:text-white font-medium text-xs">{entry.description}</div>
                      <time className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(entry.created_at).toLocaleDateString(locale)}
                      </time>
                    </div>
                  </div>
                  <div
                    className={`font-semibold font-mono text-sm ${
                      entry.entry_type === "credit"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {formatMinor(entry.amount_minor, entry.currency, locale)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payout History */}
        <div className="bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 rounded-2xl p-6 shadow-sm space-y-4 transition-colors">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200/90 dark:border-white/10 pb-3">
            {labels.payoutHistory}
          </h2>
          {payouts.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm py-6 text-center">{labels.noPayouts}</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-[#131b2e] border border-slate-200/80 dark:border-white/5 text-sm transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white font-mono">
                      {formatMinor(p.amount_minor, p.currency, locale)}
                    </div>
                    {p.bank_name && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {p.bank_name} •••• {p.account_number?.slice(-4)}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                        p.status === "completed"
                          ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : p.status === "rejected"
                          ? "bg-red-500/10 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30"
                          : "bg-amber-500/10 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {labels.payoutStatus[p.status as keyof typeof labels.payoutStatus] ?? p.status}
                    </span>
                    <time className="block text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      {new Date(p.created_at).toLocaleDateString(locale)}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Request Payout */}
      {isPayoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPayoutOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 z-10 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{labels.requestPayout}</h3>
              <button
                type="button"
                onClick={() => setIsPayoutOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {payoutError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs">
                {payoutError}
              </div>
            )}

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {labels.payoutAmount}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder="0.00"
                    value={payoutForm.amount_minor}
                    onChange={(e) =>
                      setPayoutForm((f) => ({ ...f, amount_minor: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-blue-500 min-h-[44px]"
                  />
                  <span className="absolute right-3.5 top-3 text-xs text-slate-500 font-bold">
                    {payoutForm.currency}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Available: {formatMinor(wallet.available_balance_minor, wallet.currency, locale)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {labels.payoutCurrency}
                </label>
                <select
                  value={payoutForm.currency}
                  onChange={(e) =>
                    setPayoutForm((f) => ({ ...f, currency: e.target.value as Currency }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
                >
                  <option value="IDR">IDR</option>
                  <option value="MYR">MYR</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              {methods.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                    {labels.payoutMethods}
                  </label>
                  <select
                    value={payoutForm.payout_method_id}
                    onChange={(e) =>
                      setPayoutForm((f) => ({ ...f, payout_method_id: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
                  >
                    {methods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.bank_name} •••• {m.account_number.slice(-4)} {m.is_default ? `(${labels.default})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsPayoutOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white/60 dark:hover:text-white border border-slate-200 dark:border-white/10 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestingPayout}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm inline-flex items-center gap-2 transition-all disabled:opacity-50 min-h-[44px]"
                >
                  {requestingPayout && <LoaderCircle className="animate-spin" size={14} />}
                  <span>{requestingPayout ? labels.requestingPayout : labels.requestPayout}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Payout Method */}
      {isAddMethodOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddMethodOpen(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#0a0e1a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 space-y-5 z-10 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{labels.addPayoutMethod}</h3>
              <button
                type="button"
                onClick={() => setIsAddMethodOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {methodError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 text-xs">
                {methodError}
              </div>
            )}

            <form onSubmit={handleAddMethod} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {labels.payoutType}
                </label>
                <select
                  value={methodForm.payout_type}
                  onChange={(e) =>
                    setMethodForm((f) => ({
                      ...f,
                      payout_type: e.target.value as "bank_transfer" | "e_wallet",
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer min-h-[44px]"
                >
                  <option value="bank_transfer">{labels.bankTransfer}</option>
                  <option value="e_wallet">{labels.eWallet}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {labels.bankName}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. Bank Central Asia / GoPay"
                  value={methodForm.bank_name}
                  onChange={(e) =>
                    setMethodForm((f) => ({ ...f, bank_name: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {labels.accountNumber}
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  placeholder="e.g. 1234567890"
                  value={methodForm.account_number}
                  onChange={(e) =>
                    setMethodForm((f) => ({
                      ...f,
                      account_number: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-400 mb-1.5">
                  {labels.accountHolderName}
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. Jane Doe"
                  value={methodForm.account_holder_name}
                  onChange={(e) =>
                    setMethodForm((f) => ({
                      ...f,
                      account_holder_name: e.target.value,
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0e1424] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddMethodOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-white/60 dark:hover:text-white border border-slate-200 dark:border-white/10 transition-colors min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingMethod}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm inline-flex items-center gap-2 transition-all disabled:opacity-50 min-h-[44px]"
                >
                  {addingMethod && <LoaderCircle className="animate-spin" size={14} />}
                  <span>{addingMethod ? labels.adding : labels.addMethod}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
