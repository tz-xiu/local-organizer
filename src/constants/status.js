const STATUS_TO_FILE = {
  backlog: 'backlog.md',
  'in-progress': 'in-progress-tasks.md',
  complete: 'completed-tasks.md',
  archived: 'archive-tasks.md',
};

const VALID_STATUSES = Object.keys(STATUS_TO_FILE);

function fileForStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  return STATUS_TO_FILE[status];
}

module.exports = {
  STATUS_TO_FILE,
  VALID_STATUSES,
  fileForStatus,
};


