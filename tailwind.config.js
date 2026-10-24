/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sea: "#0c3d38",
        foam: "#e4eeea",
        paper: "#f7fbfa",
        ink: "#132421",
        coral: "#e23e12",
        gold: "#8c6a32",
        line: "#c9d9d3",
        mist: "#f0f6f4",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Figtree", "sans-serif"],
        serif: ["var(--font-serif)", "Fraunces", "serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(28,25,21,0.04)",
      },
    },
  },
  plugins: [],
};
