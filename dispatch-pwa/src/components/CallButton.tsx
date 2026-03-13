type CallButtonProps = {
  active: boolean
  disabled?: boolean
  onToggle: () => void | Promise<void>
}

export default function CallButton({
  active,
  disabled = false,
  onToggle
}: CallButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative flex h-52 w-52 items-center justify-center rounded-full border text-center text-xl font-semibold tracking-wide text-white transition duration-200 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:h-60 sm:w-60 ${
        active
          ? "border-red-300/40 bg-danger shadow-[0_0_80px_rgba(239,68,68,0.45)]"
          : "border-mint/40 bg-emerald-500 shadow-[0_0_80px_rgba(16,185,129,0.35)]"
      }`}
    >
      <span className="absolute inset-4 rounded-full border border-white/15" />
      <span className="relative px-10">{active ? "END CALL" : "CALL DISPATCH"}</span>
    </button>
  )
}
