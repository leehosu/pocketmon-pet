// AI-GENERATED: 전투 종료 payload를 결과판 표시 데이터로 변환한다.
export function battleResultView(payload) {
  const winner = payload?.battle?.winner;
  if (!winner) return null;
  const reward = winner === 'player' ? Math.max(0, Math.floor(Number(payload.reward) || 0)) : 0;
  const level = Math.max(1, Math.floor(Number(payload.level) || 1));
  const totalXp = Math.max(0, Math.floor(Number(payload.totalXp) || 0));
  const leveledUp = Boolean(payload.resultChanges?.leveledUp);
  const badgeEarned = payload.resultChanges?.badgeEarned;
  return {
    won: winner === 'player',
    title: winner === 'player' ? '승리' : '패배',
    xpText: `+${reward} XP`,
    detail: winner === 'player'
      ? (badgeEarned
        ? `${badgeEarned}를 손에 넣었다! · Lv.${level}`
        : `${leveledUp ? '레벨 업 · ' : ''}Lv.${level} · 총 ${totalXp} XP`)
      : '획득 XP 0 · 포켓몬은 회복했습니다',
  };
}
