import { MockVendor } from "../_data";
import { Button } from "@/components/ui/button";

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
          className="w-full max-w-md rounded-lg border border-border bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Deactivate Vendor</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{vendor.vendorName}</p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4">
            {hasBlockers ? (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  This vendor cannot be deactivated while active parts reference it as Default
                  Vendor. Reassign or deactivate the following parts first:
                </p>
                <ul className="max-h-52 space-y-1.5 overflow-y-auto">
                  {vendor.referencingParts.map((part) => (
                    <li
                      key={part.partId}
                      className="flex items-center gap-2.5 rounded-md border border-border bg-card/40 px-3 py-2"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{part.partNumber}</span>
                      <span className="text-sm text-foreground">{part.partName}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-foreground">
                No blocking references. Vendor can be deactivated.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            {hasBlockers ? (
              <p className="text-xs text-muted-foreground">
                {vendor.referencingParts.length} part
                {vendor.referencingParts.length !== 1 ? "s" : ""} must be resolved first.
              </p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={hasBlockers}
                onClick={hasBlockers ? undefined : onConfirm}
              >
                Deactivate
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
