/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Resolve tailwindcss from frontend/, not process.cwd(): tools started from the
    // repo root otherwise look in C:\Projects\audito\node_modules and fail.
    "@tailwindcss/postcss": { base: __dirname },
  },
};

module.exports = config;
