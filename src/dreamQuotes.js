(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DreamQuotes = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const quotes = [
    {
      text: "致虚极，守静笃。",
      author: "老子",
      source: "https://ctext.org/dao-de-jing/16/zh"
    },
    {
      text: "知人者智，自知者明。",
      author: "老子",
      source: "https://ctext.org/dao-de-jing/33/zh"
    },
    {
      text: "且有大觉，而后知此其大梦也。",
      author: "庄子",
      source: "https://ctext.org/zhuangzi/adjustment-of-controversies/zh"
    },
    {
      text: "人生天地之间，若白驹之过隙，忽然而已。",
      author: "庄子",
      source: "https://ctext.org/zhuangzi/knowledge-rambling-in-the-north/zh"
    },
    {
      text: "逝者如斯夫，不舍昼夜。",
      author: "孔子",
      source: "https://ctext.org/analects/zi-han/zh"
    },
    {
      text: "此中有真意，欲辨已忘言。",
      author: "陶渊明",
      source: "https://zh.wikisource.org/wiki/飲酒_(陶淵明)"
    },
    {
      text: "行到水穷处，坐看云起时。",
      author: "王维",
      source: "https://zh.wikisource.org/wiki/終南別業"
    },
    {
      text: "浮生若梦，为欢几何？",
      author: "李白",
      source: "https://zh.wikisource.org/wiki/春夜宴從弟桃花園序"
    },
    {
      text: "回首向来萧瑟处，归去，也无风雨也无晴。",
      author: "苏轼",
      source: "https://zh.wikisource.org/wiki/定風波_(莫聽穿林打葉聲)"
    },
    {
      text: "江畔何人初见月，江月何年初照人？",
      author: "张若虚",
      source: "https://zh.wikisource.org/wiki/春江花月夜_(張若虛)"
    }
  ];

  function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getQuoteForDate(date = new Date()) {
    const dateKey = toLocalDateKey(date);
    const hash = Array.from(dateKey).reduce(
      (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
      0
    );
    return quotes[hash % quotes.length];
  }

  return { getQuoteForDate, quotes, toLocalDateKey };
});
