/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF2F01',
        black: '#000000',
        white: '#FBF6F6',
        titleColor: "#FBF6F6",
        form: "#777777",
        borderLine: "#E5E5E5",
        placeHolder: "#C9C9C9",
        notifBG: "#FFE4DE",
        notifText: "#656565",
        realWhite: "#FFFFFF",
      },
      fontFamily: {
        'heading': ['Funnel Display', 'sans-serif'],
        'body': ['Manrope', 'sans-serif'],
      },
      fontWeight: {
        'heading': '600',
        'body': '500',
      },
    },
  },
  plugins: [],
}

