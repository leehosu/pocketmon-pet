# Battle Music and XP Results Design

## Scope

Add audio feedback and a readable battle result to the existing transparent wild battle window. Generation II battle mechanics, move effects, rewards, encounter scheduling, and save semantics remain unchanged.

## Battle Music

- Generate an original Game Boy-style chiptune with the Web Audio API; do not bundle or copy Pokemon music.
- Start the loop when the battle renderer receives its first state. Retry resume on the first pointer or keyboard interaction when autoplay is blocked.
- Keep volume conservative and expose a top-right music toggle with an accessible label and persisted state for the current battle window.
- Stop the loop when the battle ends or the window unloads. Play a short original victory fanfare only on victory.

## Result Display

- After the final turn events finish, replace the move controls with a centered result panel.
- Victory shows the exact battle XP reward, current total XP, and the new level when a level-up occurred.
- Defeat shows `0 XP` and the existing immediate-recovery message.
- Keep the result visible for at least three seconds before restoring the desktop pet.

## Data Flow

The main process already commits the battle outcome before sending the final battle payload. Extend that payload with the post-battle total XP, level, and result changes. The renderer owns audio playback and presentation only; it cannot alter rewards or battle state.

## Failure Handling

Audio initialization or resume failures are non-fatal and leave the battle fully usable. Repeated result payloads do not replay the fanfare or create duplicate timers.

## Verification

- Unit-test pure chiptune sequence helpers and result-view data mapping.
- Run the complete Vitest suite and syntax checks.
- Exercise wild encounter, battle start, music toggle, final reward payload, and result visibility through the Electron renderer path.
