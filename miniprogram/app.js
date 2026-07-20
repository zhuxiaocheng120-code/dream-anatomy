const { getConfig } = require("./config/config.example");
const auth = require("./services/authAdapter");

App({
  globalData: {
    config: getConfig()
  },
  onLaunch() {
    this.globalData.config = getConfig();
    auth.initialize({ wx }).catch(() => {});
  }
});
