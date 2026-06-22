import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const keyBuffer = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        document.dispatchEvent(new CustomEvent("close-modal"));
        return;
      }

      if (e.key === "g") {
        keyBuffer.current = "g";
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { keyBuffer.current = ""; }, 500);
        return;
      }

      if (keyBuffer.current === "g") {
        keyBuffer.current = "";
        if (timerRef.current) clearTimeout(timerRef.current);
        switch (e.key) {
          case "d": navigate("/"); break;
          case "s": navigate("/sites"); break;
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [navigate]);
}