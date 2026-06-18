function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

let toastTimer: number | undefined;
export function toast(title: string, kicker: string, sub: string): void {
  byId("toastK").textContent = kicker;
  byId("toastName").textContent = title;
  byId("toastWorth").textContent = sub;
  const el = byId("toast");
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 2300);
}

let bannerTimer: number | undefined;
export function banner(text: string): void {
  const el = byId("banner");
  el.innerHTML = `<span class="k">Harbor announcement</span>${text}`;
  el.classList.add("show");
  window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => el.classList.remove("show"), 4000);
}
