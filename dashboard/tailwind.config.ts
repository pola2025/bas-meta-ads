import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'cpl-excellent': '#10B981',
        'cpl-good': '#3B82F6',
        'cpl-warning': '#F59E0B',
        'cpl-danger': '#EF4444',
      },
    },
  },
  plugins: [],
};
export default config;
