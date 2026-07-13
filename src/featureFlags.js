(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamAnatomyFeatureFlags = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  return Object.freeze({
    DEEP_GUIDANCE_ENABLED: false
  });
});
