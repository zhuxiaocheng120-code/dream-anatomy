const net = require("node:net");

function getHeader(request, name) {
  const headers = request && request.headers ? request.headers : {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
}

function normalizeIp(value) {
  const candidate = String(value || "").trim();
  return net.isIP(candidate) ? candidate : "";
}

function isCloudflareRay(value) {
  return /^[a-f0-9]{16,32}-[a-z0-9]{3}$/i.test(String(value || "").trim());
}

function getTrustedClientIp(request, env = process.env) {
  const isRenderRequest = Boolean(env && env.RENDER_EXTERNAL_HOSTNAME);
  const cloudflareIp = normalizeIp(getHeader(request, "cf-connecting-ip"));
  const cloudflareRay = getHeader(request, "cf-ray");

  if (isRenderRequest && cloudflareIp && isCloudflareRay(cloudflareRay)) {
    return cloudflareIp;
  }

  return normalizeIp(request && request.ip)
    || normalizeIp(request && request.socket && request.socket.remoteAddress)
    || "unknown";
}

module.exports = {
  getTrustedClientIp
};
