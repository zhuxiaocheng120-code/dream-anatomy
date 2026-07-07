const symbolForm = document.querySelector(".symbol-form");
const dreamSymbolInput = document.querySelector("#dreamSymbol");
const reflectionPrompt = document.querySelector("#reflectionPrompt");
const diaryForm = document.querySelector(".diary-form");
const dreamDiary = document.querySelector("#dreamDiary");
const diaryReflection = document.querySelector("#diaryReflection");

const prompts = [
  "它让你想到生活中的哪个人、地方或阶段？",
  "它出现时，你在梦里最强烈的情绪是什么？",
  "如果它会说一句话，它可能想提醒你什么？",
  "它像不像你平时不太愿意面对的某一面？"
];

symbolForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const symbol = dreamSymbolInput.value.trim();

  if (!symbol) {
    reflectionPrompt.textContent = "先写下一个梦中象征，比如：水、门、蛇、房子。";
    dreamSymbolInput.focus();
    return;
  }

  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  reflectionPrompt.textContent = `关于“${symbol}”：${prompt}`;
});

diaryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const dreamText = dreamDiary.value.trim();

  if (!dreamText) {
    diaryReflection.textContent = "先写下一点梦境片段也可以：一个画面、一种情绪，或一个醒来后仍记得的细节。";
    dreamDiary.focus();
    return;
  }

  const lengthHint = dreamText.length > 80
    ? "你已经记录了不少细节，可以先从最有情绪重量的一幕开始。"
    : "这段梦虽然简短，但一个清楚的画面也足够成为入口。";

  diaryReflection.textContent = `${lengthHint} 从荣格的角度看，梦可能不是要给出标准答案，而是在邀请你靠近某个内在部分。请试着问自己：梦里最吸引或最抗拒你的元素，是否像一个原型、阴影，或正在成长的自我声音？`;
});
