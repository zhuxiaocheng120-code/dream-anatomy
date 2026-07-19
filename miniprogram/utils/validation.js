const MAX_DREAM_TEXT_LENGTH = 5000;

function validateDreamText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    return { ok: false, message: "请先写下一点梦境内容。" };
  }
  if (text.length > MAX_DREAM_TEXT_LENGTH) {
    return { ok: false, message: "梦境内容最多 5000 字。" };
  }
  return { ok: true, value: text };
}

module.exports = { MAX_DREAM_TEXT_LENGTH, validateDreamText };
