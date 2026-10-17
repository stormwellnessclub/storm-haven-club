import printStyles from "./intakePrint.css?inline";

/** Print only the rendered intake; never copy the surrounding payment controls. */
export async function printIntake(content: HTMLElement) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write("<!doctype html><html><head><title>Spa Aella — Client Intake</title></head><body></body></html>");
  doc.close();
  const style = doc.createElement("style");
  style.textContent = printStyles;
  doc.head.appendChild(style);
  const copy = content.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("[data-intake-no-print]").forEach((node) => node.remove());
  doc.body.appendChild(copy);
  await Promise.all(Array.from(doc.images).map((image) => image.decode().catch(() => undefined)));
  win.addEventListener("afterprint", () => frame.remove(), { once: true });
  win.focus();
  win.print();
}