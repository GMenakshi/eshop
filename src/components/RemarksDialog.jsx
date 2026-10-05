import { useState } from "react";

export default function RemarksDialog({
  open,
  status, // "CONFIRMED" | "CANCELLED"
  onClose,
  onSubmit, // async (note) => void
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const required = false;
  const title =
    status === "CANCELLED" ? "Cancel this order" : "Confirm this order";

  const submit = async () => {
    const trimmed = note.trim();
    if (required && !trimmed) {
      setError("Please enter remarks for the customer.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(trimmed);
      setNote("");
      onClose();
    } catch (e) {
      setError(e?.message || "Could not update the order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {required
            ? "Remarks are required and will be shown to the customer."
            : "Remarks are optional and will be shown to the customer."}
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder={
            required ? "e.g. Out of stock" : "e.g. Will ship tomorrow"
          }
          className="mt-3 w-full rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-blue-500"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Back
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className={`rounded-lg px-4 py-2 text-sm text-white ${
              status === "CANCELLED" ? "bg-red-600" : "bg-blue-600"
            }`}
          >
            {saving ? "Saving..." : title}
          </button>
        </div>
      </div>
    </div>
  );
}