# The inner voice — terminal lab, 2026-10-05

The two playtests of 2026-10-04, cited in the experiment brief, found players lost at Grandpa Park and ready to uninstall. Glosses, repeats and six mentor notes offered passive help; nothing bridged confusion in English when it happened.

The helper is the player's own head: no character, name or mascot. English thoughts carry `›`, dim in the terminal and italic/dim on the quiet page. Dry, warm and self-mocking, each is one or two sentences and ≤140 characters. Authored clauses preserve questions and the voice's own person. Only `asked` may shorten to 56 characters. Oversized thoughts fail the content checker and are silently skipped at runtime. Voice errors are logged and swallowed, preserving core progress and saving.

| Trigger | Thought |
|---|---|
| First miss | NPC meaning and one carrying word/gloss; optional exchange `-why` supplies the explanation. |
| Second miss | English reply shape, with a successful conversation recalled when available. |
| Echo | A word-free pool for first misses/stalls whose carrying word overlaps an unearned reply; second misses keep their shape. |
| Stall | `h` thinks; in terminal type mode only empty input lets it think, otherwise it types. Tab remains hint; `?` reveals meaning. |
| Small talk | Word-free help between copy-shop jobs, avoiding mismatched topic hints. |
| New word | No duplicate during onboarding; afterwards, one gloss and Book reminder. |
| Scene end | Desk word, landlady lie, short change, earnings, March rent or understanding; attributed to the preceding day. |
| First morning | A separate stranger's-room pool without “again.” |
| Day start/night | Wallet, food budget, known words, ID, rent and day number. |
| Desk wrong twice | Shared helper selects silent initial ㅇ, final consonant or initial/vowel order. |
| Paper done | First-person inference from each paper. |

Every pool has ≥4 variants. Session/name-seeded selection consumes `${pool}-${variantIndex}` identities: four thoughts per pool/day despite changing variables, then silence. Memory clears only on a forward day change. Word nudges and paper completions remain once per game. Candidates never contain unearned Korean reply words.

Menu and level-1 hint intents remain byte-identical to the staged layer; only the voice paraphrases them. Glosses drop question/exclamation endings and later semicolon senses. Inflected words name their dictionary origin when no heard-form meaning exists. Numeric money uses Fluent's HUD formatting.

The Korean pack has `typing: null`, so Korean replies do not enter romanized type mode; empty-input `h` remains available for future courses.

The mentor retains grammar and nuance after experience ([principle 6](2026-09-25-silver-tongue-design.md)); core slot costs, resolution and events remain closed. Terminal flow: opening → name → three syllable papers → Book → scene chain, Status/Settings and save/continue. A `.view.json` sidecar stores desk/voice memory; no deletion API is added. Read-only sessions skip sidecar saves. Quiet uses the same helpers. Optional variant `why` and Korean-only `voice-ko.ftl` chrome keys preserve zh/ja text; UI variables are registered per key. Compatibility tests pin voice-sensitive fields to `be2c0fe`, with a repository snapshot for CI without git.

Deferred: Grandpa Park as a live helper requires a core slot-cost change; a companion/mascot belongs to the 3D front end. Runtime checks remain pending without dependencies.
