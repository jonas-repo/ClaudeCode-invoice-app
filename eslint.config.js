const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/', 'invoices.db'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  {
    files: ['public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    files: ['public/app.js'],
    languageOptions: { globals: { I18N: 'readonly' } },
  },
  {
    // i18n.js defines I18N as a script-scope global consumed by app.js.
    files: ['public/i18n.js'],
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^I18N$' }] },
  },
  { files: ['eslint.config.js'], languageOptions: { sourceType: 'commonjs' } },
];
