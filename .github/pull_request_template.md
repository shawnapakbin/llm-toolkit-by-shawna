## Summary

Describe what changed and why.

## Change Type

- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor
- [ ] test
- [ ] chore

## vNext Scope Marker (Required)

- [ ] This PR includes intentional next-version feature work.
- [ ] If yes, I updated [docs/VNEXT_FEATURES.md](docs/VNEXT_FEATURES.md) to include this scope.
- [ ] If no, this PR does not introduce new feature scope and is limited to hardening/bugfix/docs.

## Quality Gates

- [ ] `npm run check:ci`
- [ ] `npm run type-check`
- [ ] `npm run test:ci`
- [ ] `npm run build`
- [ ] `npm run startup:check`
- [ ] `npm run verify:all`

## Release Safety

- [ ] This PR does not add untracked release scope outside [docs/VNEXT_FEATURES.md](docs/VNEXT_FEATURES.md).
- [ ] README and release docs are updated when behavior/contracts changed.
- [ ] I did not include secrets, credentials, or environment-specific hardcoded paths.

## Notes For Reviewers

Call out any risk areas, migration notes, or follow-up tasks.
