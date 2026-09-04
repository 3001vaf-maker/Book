// Compatibility bridge only.
// Record is a Journal-owned entity; the canonical implementation lives in journal/record-data.js.
export {
  getRecords,
  getRecordsForDay,
  checkRecordTime,
  createRecord,
  updateRecord,
  cancelRecord,
  deleteRecord,
  moveRecord,
  removeRecord,
} from '../journal/record-data.js';
