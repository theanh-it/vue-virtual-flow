# Contributing

Thanks for helping improve `vue-virtual-flow`.

## Development

1. Fork and clone the repository.
2. Install dependencies with `bun install`.
3. Start the playground with `bun run dev`.
4. Add or update tests for your change.
5. Run `bun run typecheck`, `bun run test`, and `bun run build`.
6. Open a focused pull request that explains the problem and solution.

Add focused tests for fixed-height, variable-height, window, chat, carousel, or
short-media behavior as appropriate. Changes involving native scrolling,
resizing, touch gestures, or scroll snapping should also update the browser
smoke tests.
