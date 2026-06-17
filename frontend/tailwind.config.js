/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "bht-abyss": "#081418",
        "bht-deep": "#0C1E25",
        "bht-dark": "#132933",
        "bht-surface": "#16303B",
        "bht-cream": "#FFF5EF",
        "bht-accent": "rgb(var(--bht-accent) / <alpha-value>)",
        "bht-accent-soft": "rgb(var(--bht-accent-soft) / <alpha-value>)",
        "bht-accent-deep": "rgb(var(--bht-accent-deep) / <alpha-value>)",
        "bht-mint": "#8FD8C7",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-sm": "0 0 18px -2px rgb(var(--bht-accent) / 0.35)",
        glow: "0 0 36px -4px rgb(var(--bht-accent) / 0.4)",
        "glow-lg": "0 8px 60px -8px rgb(var(--bht-accent) / 0.45)",
        card: "0 16px 40px -16px rgba(0,0,0,0.55)",
        "inner-hl": "inset 0 1px 0 0 rgba(255,245,239,0.07)",
      },
      animation: {
        "fade-up": "fadeUp 0.55s cubic-bezier(0.22,1,0.36,1) both",
        "msg-in": "msgIn 0.5s cubic-bezier(0.22,1,0.36,1) both",
        caret: "caretBlink 0.9s steps(1) infinite",
        "pulse-ring": "pulseRing 1.6s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        msgIn: {
          "0%": { opacity: "0", transform: "translateY(14px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        caretBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--bht-accent) / 0.45)" },
          "70%": { boxShadow: "0 0 0 12px rgb(var(--bht-accent) / 0)" },
          "100%": { boxShadow: "0 0 0 0 rgb(var(--bht-accent) / 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
}
