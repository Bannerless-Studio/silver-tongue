import { useEffect, useRef } from "preact/hooks";

/**
 * A one-line text box that is not a form field. Chrome decides a field is a payment card from the
 * text around it, ignores autocomplete="off" for cards, and so offered saved cards on the reply box;
 * autofill never touches an editable element. Enter says it (not while an input method is composing).
 */
export function ReplyLine({ value, onInput, onEnter, placeholder, maxLength, class: cls }: {
  value: string;
  onInput: (text: string) => void;
  onEnter: () => void;
  placeholder: string;
  maxLength: number;
  class?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** the text last reported by typing: the element already shows it */
  const typed = useRef(value);
  useEffect(() => ref.current?.focus(), []);
  // Changed from outside (cleared after a send): the element holds its own text, so set it. Never on
  // what typing reported, which may already be behind what's in the element.
  useEffect(() => {
    const el = ref.current;
    if (el && value !== typed.current) {
      el.textContent = value;
      typed.current = value;
    }
  }, [value]);
  return (
    <div
      ref={ref}
      class={cls ? `reply-line ${cls}` : "reply-line"}
      contentEditable="plaintext-only"
      role="textbox"
      aria-label={placeholder}
      aria-multiline="false"
      data-placeholder={placeholder}
      spellcheck={false}
      autoCapitalize="off"
      enterkeyhint="send"
      onInput={(e) => {
        const el = e.currentTarget;
        const text = (el.textContent ?? "").replace(/[\r\n]/g, "");
        const kept = text.slice(0, maxLength);
        // A trailing <br> left by deleting everything would hide the placeholder.
        if (kept !== el.textContent) {
          el.textContent = kept;
          const sel = getSelection();
          sel?.selectAllChildren(el);
          sel?.collapseToEnd();
        }
        typed.current = kept;
        onInput(kept);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}
