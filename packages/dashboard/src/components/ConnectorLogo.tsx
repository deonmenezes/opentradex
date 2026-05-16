import { memo } from 'react';

interface ConnectorLogoProps {
  id: string;
  size?: number;
  className?: string;
}

const logos: Record<string, { bg: string; content: React.ReactNode }> = {
  polymarket: {
    bg: 'bg-[#0E1F36] ring-1 ring-[#2F6BFF]/30',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <circle cx="16" cy="16" r="14" fill="#2F6BFF" />
        <path d="M10 12h12M10 16h12M10 20h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  kalshi: {
    bg: 'bg-[#0F2A1F] ring-1 ring-[#00C853]/30',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <rect x="4" y="4" width="24" height="24" rx="6" fill="#00C853" />
        <path d="M11 10v12M11 16l7-6M11 16l7 6" stroke="#0F2A1F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  tradingview: {
    bg: 'bg-[#0E1D2E] ring-1 ring-[#2962FF]/30',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <circle cx="10" cy="22" r="3" fill="#2962FF" />
        <path d="M6 22h8v-8h8V6" stroke="#F0B722" strokeWidth="2.5" fill="none" strokeLinecap="square" />
        <rect x="20" y="4" width="8" height="8" fill="#F0B722" />
      </svg>
    ),
  },
  crypto: {
    bg: 'bg-[#181A20] ring-1 ring-[#FCD535]/30',
    content: (
      <div className="text-[10px] font-black tracking-tighter text-[#FCD535]">CRYPTO</div>
    ),
  },
  alpaca: {
    bg: 'bg-[#0F1A14] ring-1 ring-[#FFD400]/30',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <path d="M8 26 L14 8 L20 26 Z" fill="#FFD400" />
        <circle cx="14" cy="10" r="2" fill="#0F1A14" />
      </svg>
    ),
  },
  ibkr: {
    bg: 'bg-[#1A1106] ring-1 ring-[#D9202F]/30',
    content: (
      <div className="text-[10px] font-black tracking-tighter text-[#D9202F]">IBKR</div>
    ),
  },
  binance: {
    bg: 'bg-[#1F1805] ring-1 ring-[#F0B90B]/30',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <path d="M16 4 L10 10 L8 8 L16 0 L24 8 L22 10 Z M4 16 L10 10 L12 12 L6 18 Z M16 28 L10 22 L8 24 L16 32 L24 24 L22 22 Z M28 16 L22 22 L20 20 L26 14 Z M16 12 L12 16 L16 20 L20 16 Z" fill="#F0B90B" />
      </svg>
    ),
  },
  coinbase: {
    bg: 'bg-[#0B1A36] ring-1 ring-[#0052FF]/40',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <circle cx="16" cy="16" r="14" fill="#0052FF" />
        <rect x="11" y="11" width="10" height="10" rx="1.5" fill="#fff" />
      </svg>
    ),
  },
  oanda: {
    bg: 'bg-[#1A0F12] ring-1 ring-[#B8002E]/40',
    content: (
      <div className="text-[9px] font-black tracking-tight text-[#E8304A]">OANDA</div>
    ),
  },
  metatrader: {
    bg: 'bg-[#0B1628] ring-1 ring-[#26A1F1]/30',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <path d="M4 24 L4 12 L10 18 L16 10 L22 18 L28 12 L28 24 Z" fill="#26A1F1" />
      </svg>
    ),
  },
  dukascopy: {
    bg: 'bg-[#1A1A1A] ring-1 ring-white/20',
    content: (
      <div className="text-[9px] font-black tracking-tighter text-white">DUKA</div>
    ),
  },
  robinhood: {
    bg: 'bg-[#0A1A0A] ring-1 ring-[#8FD14F]/30',
    content: (
      <svg viewBox="0 0 32 32" className="w-2/3 h-2/3">
        <path d="M8 26 Q8 10 16 6 Q24 10 24 26" stroke="#8FD14F" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="16" cy="18" r="2" fill="#8FD14F" />
      </svg>
    ),
  },
  draftkings: {
    bg: 'bg-[#0A1F0A] ring-1 ring-[#53D337]/30',
    content: (
      <div className="text-[10px] font-black tracking-tighter text-[#53D337]">DK</div>
    ),
  },
};

export default memo(function ConnectorLogo({ id, size = 44, className = '' }: ConnectorLogoProps) {
  const logo = logos[id] ?? { bg: 'bg-surface-2', content: <span className="text-xs text-text-dim">?</span> };

  return (
    <div
      className={`rounded-xl flex items-center justify-center shrink-0 ${logo.bg} ${className}`}
      style={{ width: size, height: size }}
    >
      {logo.content}
    </div>
  );
});
