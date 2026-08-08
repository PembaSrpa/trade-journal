"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

export function Starfield() {
  const stars = useMemo(() => {
    return Array.from({ length: 180 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      opacity: Math.random() * 0.7 + 0.2,
      size: Math.random() > 0.9 ? 2.5 : Math.random() > 0.6 ? 1.5 : 1,
      delay: Math.random() * 3,
    }));
  }, []);

  const shootingStars = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => ({
      top: 10 + Math.random() * 50,
      left: -10 - i * 15,
      delay: i * 4 + Math.random() * 2,
      duration: 2 + Math.random(),
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none bg-[#0a0c14]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(55,138,221,0.15), transparent)",
        }}
      />
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
      {shootingStars.map((s, i) => (
        <motion.div
          key={i}
          className="absolute h-px w-24 rounded-full"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            // Tilt the streak so it's aligned with its travel path (top-left -> bottom-right)
            // instead of sitting flat/horizontal while moving diagonally.
            rotate: "18deg",
            transformOrigin: "left center",
            background:
              "linear-gradient(90deg, transparent, rgba(90,165,240,0.9), white)",
          }}
          animate={{
            x: ["0vw", "130vw"],
            y: ["0vh", "40vh"],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: s.duration,
            repeat: Infinity,
            repeatDelay: 6,
            delay: s.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}
