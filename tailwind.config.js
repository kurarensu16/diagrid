/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#15191C',
          soft: '#4A5359',
        },
        paper: {
          DEFAULT: '#F6F7F5',
          raised: '#FFFFFF',
        },
        line: '#D7DBD8',
        blueprint: '#1E5C8C',
        signal: '#D45B33',
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        none: '0px',
      },
    },
  },
  plugins: [],
}
