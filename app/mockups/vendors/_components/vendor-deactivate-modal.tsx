import { MockVendor } from "../_data";

type Props = {
  vendor: MockVendor;
  onClose: () => void;
  onConfirm: () => void;
};

export default function VendorDeactivateModal({ vendor, onClose, onConfirm }: Props) {
  const hasBlockers = vendor.referencingParts.length > 0;

  return (
    <>
      {/* Backdrop — higher z than the detail panel */}
      <div
        className="fixed inset-0 z-[60] bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Deactivate Vendor</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{vendor.vendorName}</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            {hasBlockers ? (
              <>
                <p className="mb-3 text-sm text-zinc-400">
                  This vendor cannot be deactivated while active parts reference it as Default
                  Vendor. Reassign or deactivate the following parts first:
                </p>
                <ul className="max-h-52 space-y-1.5 overflow-y-auto">
                  {vendor.referencingParts.map((part) => (
                    <li
                      key={part.partId}
                      className="flex items-center gap-2.5 rounded-md border border-zinc-800 bg-zinc-800/40 px-3 py-2"
                    >
                      <span className="font-mono text-xs text-zinc-500">{part.partNumber}</span>
                      <span className="text-sm text-zinc-300">{part.partName}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-zinc-300">
                No blocking references. Vendor can be deactivated.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-4">
            {hasBlockers ? (
              <p className="text-xs text-zinc-600">
                {vendor.referencingParts.length} part
                {vendor.referencingParts.length !== 1 ? "s" : ""} must be resolved first.
              </p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={hasBlockers ? undefined : onConfirm}
                disabled={hasBlockers}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  hasBlockers
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                    : "bg-red-700 text-white hover:bg-red-600"
                }`}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
