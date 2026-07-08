module.exports = {
  "*.{js,jsx,ts,tsx}": ["npx eslint --fix", "npx prettier --write", "git add"],
  "*.{json,css,md}": ["npx prettier --write", "git add"],
};
