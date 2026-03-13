export default function StatusIndicator({
  connected
}: {
  connected: boolean
}) {
  return (
    <div className="mt-4 text-sm">
      {connected ? "Connected to Dispatch" : "Connecting..."}
    </div>
  )
}
