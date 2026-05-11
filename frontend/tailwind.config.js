/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1220",
        muted: "#64748B",
        accent: { DEFAULT: "#3B82F6", dark: "#1D4ED8", light: "#DBEAFE" },
        good: "#10B981",
        warn: "#F59E0B",
        bad: "#EF4444",
        surface: "#FFFFFF",
        canvas: "#F8FAFC",
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)",
        cardHover: "0 8px 24px rgba(15,23,42,0.08)",
        glow: "0 0 0 4px rgba(59,130,246,0.15)",
      },
      borderRadius: { xl2: "1rem" },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 300ms ease-out",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
