import './draftKept.css'

/**
 * "Draft kept" (6.2): under a field whose unsaved words have reached storage
 * as a draft (lib/drafts, useDraftKept), so the gardener knows a reload or a
 * closed tab will not lose them. The field names it with aria-describedby.
 * Not a live region: it would otherwise speak up every time typing paused.
 */
export function DraftKept({ id }: { id: string }) {
  return (
    <small className="draft-kept" id={id}>
      Draft kept
    </small>
  )
}
