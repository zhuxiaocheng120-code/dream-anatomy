function createLocalRecordId(now = Date.now(), random = Math.random()) {
  const suffix = Math.floor(random * 0xffffffff).toString(16).padStart(8, "0");
  return `local_${now.toString(36)}_${suffix}`;
}

module.exports = { createLocalRecordId };
