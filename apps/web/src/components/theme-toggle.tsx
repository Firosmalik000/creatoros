"use client";

import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { Sun, Moon, Laptop, Check } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";

const emptySubscribe = () => () => {};

export function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!isClient) {
    return (
      <div
        className={`w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 ${className}`}
      />
    );
  }

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Terang (Light)", icon: Sun },
    { value: "dark", label: "Gelap (Dark)", icon: Moon },
    { value: "system", label: "Sistem (Auto)", icon: Laptop },
  ];

  return (
    <div ref={menuRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shadow-xs cursor-pointer"
        aria-label="Ubah tema tampilan (Dark / Light mode)"
        title="Ubah tema tampilan"
      >
        {resolvedTheme === "dark" ? (
          <Moon size={16} className="text-blue-400" />
        ) : (
          <Sun size={16} className="text-amber-500" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-white dark:bg-[#0e1424] border border-slate-200/90 dark:border-white/10 shadow-xl shadow-black/10 dark:shadow-black/50 p-1.5 z-50 text-xs font-medium backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Tema Tampilan
          </div>
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTheme(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon size={14} />
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check size={14} className="text-blue-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
