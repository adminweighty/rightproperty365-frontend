"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * A number that counts up when it scrolls into view. The server renders the
 * final value, so it is correct without JavaScript and under reduced motion.
 */
export function StatCounter({ value, className }: { value: number; className?: string }) {
  const element = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const counter = { current: 0 };
      gsap.to(counter, {
        current: value,
        duration: 1.4,
        ease: "power2.out",
        scrollTrigger: { trigger: element.current, start: "top 95%", once: true },
        onUpdate: () => {
          if (element.current) element.current.textContent = String(Math.round(counter.current));
        },
      });
    });
  }, [value]);

  return (
    <span ref={element} className={className}>
      {value}
    </span>
  );
}
