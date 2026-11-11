// Tiny DOM helper.

type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'html') el.innerHTML = String(v);
    else if (k in el) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

export const clear = (el: HTMLElement): void => { while (el.firstChild) el.removeChild(el.firstChild); };

/** A labelled range slider. Returns the row and a setter. */
export function slider(label: string, min: number, max: number, step: number, value: number, onInput: (v: number) => void, fmt: (v: number) => string = String): { row: HTMLElement; set: (v: number) => void } {
  const out = h('span', { class: 'val' }, fmt(value));
  const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label,
    oninput: () => { const v = Number(input.value); out.textContent = fmt(v); onInput(v); } });
  const row = h('label', { class: 'row slider' }, h('span', { class: 'lbl' }, label), input, out);
  return { row, set: (v) => { input.value = String(v); out.textContent = fmt(v); } };
}

/** A group of mutually exclusive buttons. */
export function segmented<T extends string>(options: Array<[T, string]>, value: T, onChange: (v: T) => void): { el: HTMLElement; set: (v: T) => void } {
  const buttons = new Map<T, HTMLButtonElement>();
  const set = (v: T) => { for (const [k, b] of buttons) b.classList.toggle('on', k === v); };
  const el = h('div', { class: 'seg', role: 'group' }, ...options.map(([k, text]) => {
    const b = h('button', { type: 'button', onclick: () => { set(k); onChange(k); } }, text);
    buttons.set(k, b);
    return b;
  }));
  set(value);
  return { el, set };
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void, title = ''): { el: HTMLButtonElement; set: (v: boolean) => void } {
  let state = value;
  const el = h('button', { type: 'button', class: 'chip' + (value ? ' on' : ''), title, 'aria-pressed': String(value), onclick: () => { state = !state; apply(); onChange(state); } }, label);
  const apply = () => { el.classList.toggle('on', state); el.setAttribute('aria-pressed', String(state)); };
  return { el, set: (v) => { state = v; apply(); } };
}
