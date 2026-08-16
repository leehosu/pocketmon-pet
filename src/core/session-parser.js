// Claude Code 세션 로그(~/.claude/projects/**/*.jsonl): assistant 메시지의 message.usage.
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

// Codex 세션 로그(~/.codex/sessions/**/rollout-*.jsonl): event_msg의 token_count 이벤트.
// 토큰은 payload.info.last_token_usage(그 턴 증분)에서, ts는 라인 timestamp에서.
// Codex 이벤트엔 uuid가 없어 id를 ts+누적토큰으로 합성한다(applyEvents가 id로 중복 제거).
export function parseCodexLines(lines, sinceTs = 0) {
  const out = [];
  for (const raw of lines) {
    let obj;
    try { obj = JSON.parse(raw); } catch { continue; }
    const payload = obj?.payload;
    if (!payload || payload.type !== 'token_count') continue;
    const usage = payload.info?.last_token_usage;
    if (!usage) continue;
    const ts = Date.parse(obj.timestamp);
    if (!Number.isFinite(ts) || ts <= sinceTs) continue;
    const tokens = (usage.input_tokens || 0) + (usage.output_tokens || 0);
    if (tokens <= 0) continue;
    const total = payload.info?.total_token_usage?.total_tokens ?? usage.total_tokens ?? ts;
    out.push({ id: `codex:${ts}:${total}`, kind: 'tokens', tokens, ts });
  }
  return out;
}
