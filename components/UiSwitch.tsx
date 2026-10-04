"use client";

import { useEffect, useState } from "react";
import { UIS, UI_STORAGE_KEY, type UiId } from "@/lib/ui";

const isUi = (v: string | null | undefined): v is UiId =>
  UIS.some((u) => u.id === v);

/**
 * Swap the look's stylesheet without a flash: add
 * the new <link>, drop the old one once it loads.
 */
function applyUi(ui: UiId) {
  const root = document.documentElement;
  if (root.dataset.ui === ui) return;
  const old = document.getElementById("uiCss");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `/ui/${ui}.css`;
  link.addEventListener("load", () => {
    old?.remove();
    link.id = "uiCss";
  });
  document.head.appendChild(link);
  root.dataset.ui = ui;
  try {
    localStorage.setItem(UI_STORAGE_KEY, ui);
  } catch {}
  const hash = ui === UIS[0].id ? "" : `#ui=${ui}`;
  history.replaceState(
    null,
    "",
    location.pathname + location.search + hash
  );
}

export default function UiSwitch() {
  const [ui, setUi] = useState<UiId>(UIS[0].id);

  useEffect(() => {
    const current = document.documentElement.dataset.ui;
    if (isUi(current)) setUi(current);
    const onHash = () => {
      const m = /(?:^#|[#&])ui=([a-z]+)/.exec(
        location.hash
      );
      if (m && isUi(m[1])) {
        applyUi(m[1]);
        setUi(m[1]);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () =>
      window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <>
      <label className="sr-only" htmlFor="uiSwitch">
        Interface look
      </label>
      <select
        id="uiSwitch"
        className="uiswitch"
        title="Switch the interface look"
        value={ui}
        onChange={(e) => {
          const next = e.target.value;
          if (!isUi(next)) return;
          applyUi(next);
          setUi(next);
        }}
      >
        {UIS.map((u) => (
          <option key={u.id} value={u.id}>
            UI: {u.label}
          </option>
        ))}
      </select>
    </>
  );
}
