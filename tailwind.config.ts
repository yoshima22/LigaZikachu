import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0f1f",
        foreground: "#f8fafc",
        muted: "#111827",
        border: "#1f2937",
        primary: {
          DEFAULT: "#facc15",
          foreground: "#0a0f1f"
        },
        secondary: {
          DEFAULT: "#60a5fa",
          foreground: "#081120"
        },
        accent: {
          DEFAULT: "#34d399",
          foreground: "#052e2b"
        }
      },
      boxShadow: {
        card: "0 18px 48px rgba(15, 23, 42, 0.28)"
      }
    }
  },
  plugins: []
};

export default config;
