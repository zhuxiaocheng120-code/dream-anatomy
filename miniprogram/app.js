const { getConfig } = require("./config/config.example");

App({
  globalData: {
    config: getConfig()
  },
  onLaunch() {
    this.globalData.config = getConfig();
  }
});
