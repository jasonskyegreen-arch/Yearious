/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["ui-sans-serif","system-ui","Inter","Segoe UI","Roboto","Helvetica","Arial"]
      },
      boxShadow: {
        soft: "0 10px 30px -10px rgba(0,0,0,0.3)"
      }
    }
  },
  plugins: []
}
