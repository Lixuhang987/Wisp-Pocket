import type { Ref } from "react";
import type { PetDraftFile } from "./petThreadController.ts";

export function PetReply({ draft, setDraft, files, onRemoveFile, onChooseFiles, onNewTopic, onRespond, onStop, inputRef, submitting, running, choosing }: {
  draft: string;
  setDraft: (text: string) => void;
  files: PetDraftFile[];
  onRemoveFile: (id: string) => void;
  onChooseFiles: () => void;
  onNewTopic: () => void;
  onRespond: (text: string) => void;
  onStop: () => void;
  inputRef: Ref<HTMLTextAreaElement>;
  submitting: boolean;
  running: boolean;
  choosing: boolean;
}) {
  return <form className="pet-reply" data-pet-interactive onSubmit={(event) => {
    event.preventDefault();
    if (running) onStop(); else if (!choosing) onRespond(draft);
  }}>
    {files.length > 0 && <div className="pet-draft-files" aria-label="待发送文件">
      {files.map(file => {
        const name = file.path.split("/").at(-1) || "文件";
        return <span className="pet-draft-file" key={file.id}>
          <span>{name}</span>
          <button type="button" aria-label={`移除 ${name}`} title={`移除 ${name}`} onClick={() => onRemoveFile(file.id)}>×</button>
        </span>;
      })}
    </div>}
    <div className="pet-reply-input">
      <textarea ref={inputRef} aria-label="回复当前对话" placeholder="说说你的想法…" rows={1} value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
            event.preventDefault();
            if (!choosing) onRespond(draft);
          }
        }} />
      <button className="pet-submit" type="submit" aria-label={running ? "停止本轮" : "发送回复"} title={running ? "停止本轮" : "发送回复"}
        disabled={!running && (submitting || choosing || (!draft.trim() && !files.length))}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {running ? <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" />
            : <path d="M12 19V5m-6 6 6-6 6 6" />}
        </svg>
      </button>
    </div>
    <div className="pet-reply-tools" role="toolbar" aria-label="对话工具">
      <button type="button" aria-label="添加文件" title="添加文件到上下文" disabled={choosing} onClick={onChooseFiles}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8" /></svg>
      </button>
      <button type="button" aria-label="新建对话" title="新建对话" onClick={onNewTopic}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4H5v16h14v-9M16 2v8m-4-4h8" /></svg>
      </button>
    </div>
  </form>;
}
