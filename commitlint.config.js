module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Raised from the conventional default of 100. The project's custom footer tokens
    // (Deviation-Summary:, Deviates-From:) are not recognized by the parser as footers,
    // so they are subject to body-max-line-length rather than footer-max-line-length.
    // 200 chars accommodates long Deviation-Summary lines while remaining unreachable by
    // normal prose body lines.
    'body-max-line-length': [2, 'always', 200],
  },
};
