export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a href="https://allonel.ink" className="flex items-center gap-3" aria-label="Allonelink home">
      <img
        src="/brand/allonelink-icon-light.png"
        alt=""
        className="h-11 w-11 rounded-2xl object-cover shadow-[0_10px_28px_rgba(59,130,246,.2)]"
      />
      {!compact && (
        <span className="text-xl font-extrabold tracking-[-.045em] text-slate-950">
          Allone<span className="brand-text">link</span>
        </span>
      )}
    </a>
  )
}
