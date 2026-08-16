export function parseSessionLines(lines, sinceTs = 0) {
  const out = [];
  for (const raw of lines) {
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }
    const usage = obj?.message?.usage;
    if (!usage) continue;
    const ts = Date.parse(obj.timestamp);
    if (!Number.isFinite(ts) || ts <= sinceTs) continue;
    const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
    if (tokens <= 0) continue;
    out.push({ id: obj.uuid, kind: 'tokens', tokens, ts });
  }
  return out;
}
