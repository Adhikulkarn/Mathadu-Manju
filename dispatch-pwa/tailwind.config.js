export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#08111f",
        panel: "#0f1d31",
        accent: "#ff8a3d",
        mint: "#5eead4",
        danger: "#ef4444"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: []
}
