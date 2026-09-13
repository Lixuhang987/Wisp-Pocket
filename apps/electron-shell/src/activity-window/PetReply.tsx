export function PetReply({ suggestedReplies, draft, setDraft, onRespond }: {
  suggestedReplies: readonly string[];
  draft: string;
  setDraft: (text: string) => void;
  onRespond: (text: string) => void;
}) {
  return <div className="pet-controls">
    {suggestedReplies.length > 0 && <div className="pet-suggestions pet-current-suggestions" data-pet-scroll-viewport aria-label="当前建议">
      {suggestedReplies.map((reply) => <button type="button" data-pet-interactive key={reply}
        onClick={() => onRespond(reply)}>{reply}</button>)}
    </div>}
    <form className="pet-reply" data-pet-interactive onSubmit={(event) => { event.preventDefault(); onRespond(draft); }}>
      <textarea aria-label="回复当前对话" placeholder="说说你的想法…" rows={2} value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onRespond(draft); }
        }} />
      <button type="submit" aria-label="发送回复" disabled={!draft.trim()}>↑</button>
    </form>
  </div>;
}
