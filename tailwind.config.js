/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 10px 30px rgba(15,23,42,0.08)",
      },
      borderRadius: {
        xl: "1rem",
      },
      fontFamily: {
        sans: ["Pretendard", "Outfit", "Noto Sans KR", "sans-serif"],
      },
      colors: {
        surface: {
          default: "var(--surface-default)",
          strong: "var(--surface-strong)",
          stronger: "var(--surface-stronger)",
          strongest: "var(--surface-strongest)",
          inverse: "var(--surface-inverse)",
          brand: "var(--surface-brand)",
          success: "var(--surface-success)",
          warning: "var(--surface-warning)",
          danger: "var(--surface-danger)",
        },
        text: {
          default: "var(--text-default)",
          subtle: "var(--text-subtle)",
          subtlest: "var(--text-subtlest)",
          disabled: "var(--text-disabled)",
          inverse: "var(--text-inverse)",
          brand: "var(--text-brand)",
          success: "var(--text-success)",
          warning: "var(--text-warning)",
          danger: "var(--text-danger)",
        },
        brand: {
          10: "var(--brand-10)",
          20: "var(--brand-20)",
          30: "var(--brand-30)",
          50: "var(--brand-50)",
          60: "var(--brand-60)",
          70: "var(--brand-70)",
          80: "var(--brand-80)",
        },
      },
    },
  },
  plugins: [],
};
