import type { Ref } from "react";

export function PetReply({ draft, setDraft, onRespond, inputRef, submitting }: {
  draft: string;
  setDraft: (text: string) => void;
  onRespond: (text: string) => void;
  inputRef: Ref<HTMLTextAreaElement>;
  submitting: boolean;
}) {
  return <form className="pet-reply" data-pet-interactive onSubmit={(event) => { event.preventDefault(); onRespond(draft); }}>
    <textarea ref={inputRef} aria-label="回复当前对话" placeholder="说说你的想法…" rows={1} value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onRespond(draft); }
      }} />
    <button type="submit" aria-label="发送回复" disabled={!draft.trim() || submitting}>↑</button>
  </form>;
}
