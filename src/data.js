// Legacy shim: re-export service API for backward compatibility
module.exports = {
  ...require('./tasks/service'),
  VALID_STATUSES: require('./constants/status').VALID_STATUSES,
  STATUS_TO_FILE: require('./constants/status').STATUS_TO_FILE,
  ensureDataFiles: require('./tasks/markdownRepository').ensureDataFiles,
};


