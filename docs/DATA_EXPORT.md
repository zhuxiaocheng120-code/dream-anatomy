# Data Export

Dream Anatomy supports two user-facing exports from the `隐私与数据` page.

## Readable Dream Archive

Primary action:

```text
导出可阅读的梦境档案
```

Filename:

```text
dream-anatomy-archive-YYYY-MM-DD.html
```

The file is UTF-8 HTML, opens offline, references no remote scripts, fonts, images, or stylesheets, and contains no executable JavaScript. It uses an embedded parchment / quiet archive style so users can read it directly in a browser and print or save it as PDF.

Each dream may include:

- Date and time
- Original dream text
- Dream summary
- Sleep feeling
- Emotion
- Symbols
- AI analysis
- Dream Result Card
- Four dimensions
- User reflection
- Safety reminder

All user and AI text is HTML escaped before insertion.

## Raw Data Backup

Secondary action:

```text
导出原始数据备份（JSON）
```

Filename:

```text
dream-anatomy-export-YYYY-MM-DD.json
```

This export is meant for backup, migration, or technical processing. Opening it directly in a browser or text editor will show structured data.

## Exclusions

Neither export includes:

- access token
- refresh token
- Authorization header
- email
- full Supabase user UUID
- principal hash
- WeChat identity hash
- Session Token
- admin analytics
- other account data

Export does not call DeepSeek and does not consume AI quota.

