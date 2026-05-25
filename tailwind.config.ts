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
        },
        // Cores de tipo Pokémon
        "pokemon-fire":     "#EE8130",
        "pokemon-water":    "#6390F0",
        "pokemon-electric": "#F7D02C",
        "pokemon-grass":    "#7AC74C",
        "pokemon-psychic":  "#F95587",
        "pokemon-ghost":    "#735797",
        "pokemon-fighting": "#C22E28",
        "pokemon-rock":     "#B6A136",
        "pokemon-normal":   "#A8A77A",
        "pokemon-poison":   "#A33EA1",
        "pokemon-ground":   "#E2BF65",
        "pokemon-flying":   "#A98FF3",
        "pokemon-bug":      "#A6B91A",
        "pokemon-ice":      "#96D9D6",
        "pokemon-dragon":   "#6F35FC",
        "pokemon-dark":     "#705746",
        "pokemon-steel":    "#B7B7CE",
        "pokemon-fairy":    "#D685AD",
        // Liga Zikachu brand
        "zikachu-yellow":   "#FFCB05",
        "zikachu-blue":     "#3D7DCA",
        "zikachu-red":      "#FF1C1C",
        "zikachu-dark":     "#1A1A2E"
      },
      fontFamily: {
        pixel: ["var(--font-press-start)", "monospace"],
        sans:  ["var(--font-inter)", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card:         "0 18px 48px rgba(15, 23, 42, 0.28)",
        "card-hover": "0 24px 60px rgba(255, 203, 5, 0.15)",
        "poke-glow":  "0 0 20px rgba(255, 203, 5, 0.25)"
      },
      backgroundImage: {
        "poke-gradient": "linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #0F3460 100%)",
        "card-gradient": "linear-gradient(145deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)"
      },
      keyframes: {
        "card-float": {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%":       { transform: "translateY(-4px) rotate(0.5deg)" }
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        "card-float": "card-float 3s ease-in-out infinite",
        shimmer:      "shimmer 2s linear infinite"
      }
    }
  },
  plugins: []
};

export default config;
