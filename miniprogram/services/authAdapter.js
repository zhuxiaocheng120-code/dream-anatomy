const guestState = {
  mode: "guest",
  authenticated: false,
  cloudSyncAvailable: false
};

function getAuthState() {
  return { ...guestState };
}

async function getAccessToken() {
  return "";
}

async function login() {
  return getAuthState();
}

async function logout() {
  return getAuthState();
}

function isCloudSyncAvailable() {
  return false;
}

module.exports = {
  getAccessToken,
  getAuthState,
  isCloudSyncAvailable,
  login,
  logout
};
