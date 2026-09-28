# The Hollow Roots — project handoff

This is the shared status file for work on the game from different devices or AI assistants. **Read it before changing the game and update it after each meaningful change.** The GitHub branch is the shared source of truth; a local checkout can be behind even when another device has pushed newer work.

## Repository and publishing

- Repository: `https://github.com/Manandi/god`
- Active branch: `claude/practical-babbage-tbonr1`. Fetch it and inspect `git status` before editing. Integrate newer commits without force pushing or discarding local changes.
- Root project: Phaser 2D game. Preserve its code and save data while working on the separate 3D prototype.
- `first-person-verdant/`: Vite/Three.js 3D game. Read its [README](first-person-verdant/README.md), combat and camera code, and the deployment configuration before editing.
- GitHub Actions [Pages workflow](.github/workflows/pages.yml) publishes the 2D game at `https://manandi.github.io/god/` and this branch's 3D game at `https://manandi.github.io/god/verdant/`.
- The existing owner-private 3D Site is `https://verdant-reach-first-person.manandi.chatgpt.site`, configured by `first-person-verdant/.openai/hosting.json`. Its source repository has some independent character/performance work. Merge deliberately; do not overwrite it wholesale with the GitHub tree. The root `.openai/hosting.json` belongs to the separate 2D Site.

## Latest shared state — 2026-09-28

- Latest GitHub game commit inspected here: `ecf0fbbeba481281264b26525dc55db16b82c72c` (`Merge remote first-person polish into the combat overhaul`). The PC's newer work is present on the branch, including charged heavy attacks, Breath/stamina, poise/topples, and three shellback attacks. Earlier first-person camera and combat polish is also included.
- The previous 3D Site deployment succeeded for its own source commit `4a4f2ebb1fadad80c933028fcb760ff54b414ad7`, before the PC combat overhaul. Check its source and deployment status before claiming it matches GitHub Pages.
- This checkout was fast-forwarded cleanly to `ecf0fbb` on September 28. No game fixes from the September 28 browser annotations have been committed yet.

## Current feedback and next work

1. The atlas globe appears black on GitHub Pages. `first-person-verdant/src/globe.js` loads `/art/world-surface-v2.webp` from the domain root; the Pages game lives under `/god/verdant/`. Use the Vite base URL and verify the published texture.
2. Some visible objects can be walked through. Audit the rendered world's collider list and the player's collision/step handling, especially rocks, trees, and structures. Test in both views.
3. Third-person limbs can look joined or distorted, and the rounded authored arms do not match the square first-person hands. Inspect the actual `explorer.glb` and rig/animation in the deployed build; this sparse local checkout currently excludes that large binary asset.
4. The player requested a town and NPCs made with Blender and image generation. These are **not built yet**. Keep them in the existing 3D world and record asset sources/licences. Do not describe them as shipped until playable and verified.

## How to hand off work

After each meaningful task, update this file with the date, the exact commit, what changed, what was tested, what was published and verified, and remaining issues. Keep the newest update above older notes; remove stale claims. Run `npm ci`, `npm run dev` and `npm run build` in `first-person-verdant/` for 3D changes. Use `?arena&debug` or F3 for combat testing. Run root checks when touching the 2D project. Commit and push to the existing branch, then verify the GitHub Actions run and live Pages result. If updating the 3D Site, push its **existing** source repository and verify the deployment separately. Never claim a deployment is live from a successful push alone.
