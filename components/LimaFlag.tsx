/** Bandeira L (Lima) do Código Internacional de Sinais: aviso aos competidores */
export default function LimaFlag({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={(size * 2) / 3} viewBox="0 0 3 2" className={`shrink-0 rounded-[2px] ring-1 ring-black/20 ${className}`} aria-label="Bandeira L">
      <rect width="3" height="2" fill="#111" />
      <rect width="1.5" height="1" fill="#FFD100" />
      <rect x="1.5" y="1" width="1.5" height="1" fill="#FFD100" />
    </svg>
  );
}
