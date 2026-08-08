import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#171717",
        surface: "#262626",
        "surface-2": "#2e2e2e",
        border: "#404040",
        "border-strong": "#525252",
        text: "#e5e5e5",
        "text-secondary": "#8b93a1",
        "text-muted": "#6b7280",
        accent: "#378ADD",
        "accent-dim": "#2a3f52",
        "accent-glow": "#5aa5f0",
        success: "#2fbf71",
        danger: "#e0554f",
        warning: "#e0a52f",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        base: "16px",
        lg: "18px",
        xl: "24px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.9" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        twinkle: "twinkle 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
