import { useRef, useEffect, useState, RefObject } from "react";

/**
 * Sets the title attribute on an element only when its content is being
 * truncated by CSS (overflow + ellipsis). Avoids redundant tooltips on
 * rows where the text fits without clipping.
 *
 * Usage:
 *   const { ref, title } = useTruncatedTitle<HTMLSpanElement>(text);
 *   return <span ref={ref} title={title} className="block truncate">{text}</span>;
 */
export function useTruncatedTitle<T extends HTMLElement = HTMLElement>(
  fullText: string
): { ref: RefObject<T | null>; title: string | undefined } {
  const ref = useRef<T>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    function check() {
      if (ref.current) {
        setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
      }
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [fullText]);

  return {
    ref,
    title: isTruncated ? fullText : undefined,
  };
}
