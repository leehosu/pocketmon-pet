# Hook 설치

`~/.claude/settings.json`의 hooks에 아래를 추가한다(경로는 이 레포 절대경로로):

동일한 command를 4개 이벤트에 등록한다(SessionStart=등장, PostToolUse=기술,
UserPromptSubmit=달리기 시작, Stop=idle 복귀):

```json
{
  "hooks": {
    "SessionStart":     [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ],
    "PostToolUse":      [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ],
    "UserPromptSubmit": [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ],
    "Stop":             [ { "hooks": [{ "type": "command", "command": "node /ABSOLUTE/PATH/pocketmon-desktop/hook/pocketmon-hook.js" }] } ]
  }
}
```

훅은 이벤트를 `~/.pocketmon/events.jsonl`에 append하며, 앱이 이를 감시해
XP·활동 애니메이션(달리기/기술)에 반영한다.
