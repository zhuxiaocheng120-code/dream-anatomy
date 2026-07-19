const { normalizeResultCard } = require("../../services/resultCard");

Component({
  properties: {
    card: {
      type: Object,
      value: null
    }
  },
  observers: {
    card(value) {
      this.setData({ normalized: normalizeResultCard(value || {}) });
    }
  },
  data: {
    normalized: normalizeResultCard({})
  }
});
