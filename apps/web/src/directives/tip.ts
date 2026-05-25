import type { Directive } from "vue";

// A single shared, fixed-position tooltip bubble — never clipped by panels.
let bubble: HTMLDivElement | null = null;

function ensureBubble(): HTMLDivElement {
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.className = "tip-bubble";
    document.body.appendChild(bubble);
  }
  return bubble;
}

function show(text: string, target: HTMLElement): void {
  if (!text) return;
  const el = ensureBubble();
  el.textContent = text;
  el.classList.add("visible");
  const t = el.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  const margin = 9;
  let left = r.left + r.width / 2 - t.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
  let top = r.top - t.height - margin;
  if (top < 8) top = r.bottom + margin;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

function hide(): void {
  bubble?.classList.remove("visible");
}

type TipEl = HTMLElement & { __tipCleanup?: () => void };

/** Usage: v-tip="'Helpful description'" */
export const tip: Directive<TipEl, string | undefined> = {
  mounted(el, binding) {
    let text = binding.value ?? "";
    const enter = (): void => show(text, el);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("focus", enter);
    el.addEventListener("mouseleave", hide);
    el.addEventListener("blur", hide);
    el.addEventListener("click", hide);
    el.__tipCleanup = () => {
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("focus", enter);
      el.removeEventListener("mouseleave", hide);
      el.removeEventListener("blur", hide);
      el.removeEventListener("click", hide);
    };
    // keep text current via a closure updater
    (el as TipEl & { __tipSet?: (v: string) => void }).__tipSet = (v: string) => {
      text = v;
    };
  },
  updated(el, binding) {
    (el as TipEl & { __tipSet?: (v: string) => void }).__tipSet?.(binding.value ?? "");
  },
  unmounted(el) {
    el.__tipCleanup?.();
    hide();
  },
};
