import {
  ACCURACY_FILL,
  ACCURACY_LABEL,
  STANCE_FILL,
  STANCE_LABEL,
  chipText,
} from "@/lib/curation/labels";
import type { AccuracyFlag, Stance } from "@/lib/data/types";

// The fact-vs-opinion signal (design §9, CURATION §2–§4). The LABEL text is the
// signal; color reinforces. Text is bold + ≥10px on AA-safe fills (§9.3).
const base =
  "inline-flex items-center border-2 border-hardbox px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white";

export function StanceChip({
  stance,
  modifier,
}: {
  stance: Stance;
  modifier?: string;
}) {
  const text = chipText(STANCE_LABEL[stance], modifier);
  return (
    <span className={base} style={{ background: STANCE_FILL }} title={text}>
      {text}
    </span>
  );
}

export function AccuracyChip({
  flag,
  modifier,
}: {
  flag: AccuracyFlag;
  modifier?: string;
}) {
  const text = chipText(ACCURACY_LABEL[flag], modifier);
  return (
    <span className={base} style={{ background: ACCURACY_FILL[flag] }} title={text}>
      {text}
    </span>
  );
}
