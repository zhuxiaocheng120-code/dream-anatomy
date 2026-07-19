const API_BASE_URL = "https://dream-anatomy.onrender.com";
const REQUEST_TIMEOUT_MS = 45000;

function getConfig() {
  return {
    API_BASE_URL,
    REQUEST_TIMEOUT_MS
  };
}

module.exports = { API_BASE_URL, REQUEST_TIMEOUT_MS, getConfig };
