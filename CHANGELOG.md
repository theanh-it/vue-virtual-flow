# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-14

### Added
- **VirtualCarousel**: Add configurable mouse dragging, momentum, controlled snapping, intrinsic `autoWidth` slides, RTL support, continuous looping, bounded keep-alive caching, and pinned slide instances
- **ChatVirtualScroll**: Add per-message size estimates, scroll activity state, visible-range events, key-based scrolling, logical position restoration, pinned/focused message retention, forced bottom-follow rules, and configurable synchronous measurement
- **ChatVirtualScroll**: Add an accessible new-message counter with a customizable slot and localized built-in label
- **ChatVirtualScroll**: Add `itemsVersion` and `refresh()` for explicitly reconciling arbitrary in-place mutations without an always-on deep watcher

### Fixed
- **ChatVirtualScroll**: Anchor native scrolling at the bottom so prepended history is immediately reachable during touch scrolling, without rebasing the scroll position
- **ChatVirtualScroll**: Preserve the reading position when messages below the viewport resize or new messages arrive during a gesture
- **ChatVirtualScroll**: Keep the new-message control inside the viewport instead of scrolling it away with message content
- **ChatVirtualScroll**: Defer measurement corrections during wheel, keyboard, touch, smooth-scroll, and scrollbar-drag activity so native momentum is not interrupted
- **ChatVirtualScroll**: Use stable identity fallbacks instead of array indexes and reject duplicate keys before they can corrupt measurements or anchors

### Improved
- **VirtualCarousel**: Extract autoplay, interaction, layout, and motion responsibilities and add cross-browser regression coverage for dragging, looping, RTL, auto-width, and cached state
- **ChatVirtualScroll**: Measure previously unseen messages before paint and update append, prepend, measurement, offset, and key operations through an incremental keyed index
- **ChatVirtualScroll**: Remove the duplicate measured-height map and split input activity from layout/measurement logic
- Cover cold variable-height scrolling, native Chromium touch input, new-message overlay geometry, and prepend/resize anchoring across Chromium, Firefox, and WebKit

### Changed
- The chat's internal DOM `scrollTop` is now negative above the bottom. Exposed scrolling methods and `scroll` event offsets remain measured from the top; use those APIs instead of accessing the native offset directly
- **ChatVirtualScroll**: Add a `.vue-chat-virtual-scroll__root` layout wrapper while keeping inherited attributes on the scroll viewport
- **ChatVirtualScroll**: Duplicate keys now fail fast; every message must have a unique stable key

## [0.0.7] - 2026-09-29

### Fixed
- **ChatVirtualScroll**: Preserve visible message DOM and scroll position when older messages are prepended
- **ChatVirtualScroll**: Defer native scroll corrections during touch gestures and momentum while visually compensating for measured height changes
- **ChatVirtualScroll**: Prevent gaps at the top and double scroll adjustments near the bottom when message heights shrink

### Improved
- Reserve image dimensions in the chat playground to reduce layout shifts while media loads
- Added regression coverage for touch scrolling, prepend anchoring, height changes, imperative scrolling, and cleanup across unit and browser tests

## [0.0.6] - 2026-09-29

### Added
- **ChatVirtualScroll**: Added an optional `size` prop to limit mounted messages including overscan, while always keeping enough messages to fill the viewport

### Improved
- Added English and Vietnamese documentation for `size` and configured the chat playground with a render budget of 12 messages
- Added regression tests for render budgets, reactive updates, variable message heights, append/prepend behavior, and scrolling up in a portrait mobile viewport

## [0.0.5] - 2026-09-29

### Added
- **SkeletonLoader**: Added configurable dimensions, rectangle/rounded/circle variants, shimmer animation, reduced-motion support, and an accessible loading label
- **Public API**: Exported `SkeletonLoader` and `SkeletonLoaderProps`, and registered the component in the Vue plugin
- **Playground**: Added skeleton placeholders to the load-more demo

### Improved
- Added English and Vietnamese SkeletonLoader usage guides
- Converted API references and usage recipes into tables, including event listeners, ref actions, responsive configuration, autoplay, and release commands

## [0.0.4] - 2026-09-11

### Added
- **WindowGirdVirtualScroll**: Added fixed-height, multi-column window virtualization with configurable columns, gaps, overscan, loading, pull-to-refresh, and imperative scrolling
- **Playground**: Added an interactive window grid demo with column controls and direct item navigation

### Fixed
- **WindowDynamicVirtualScroll**: Reset stale measurements and load-more state when the item key set changes without changing the item count
- **WindowDynamicVirtualScroll**: Batched window scroll and ResizeObserver updates with `requestAnimationFrame` to reduce redundant work
- **WindowDynamicVirtualScroll**: Cancelled pending frames and guarded deferred callbacks during component cleanup

### Improved
- Added regression coverage for window scroll batching, resize compensation, same-size dataset replacement, and lifecycle cleanup

## [0.0.3] - 2026-08-08

### Fixed
- **All Components**: Smooth scroll animation now works correctly for all distances instead of being force-disabled when scrolling > 3 viewports
- **VirtualCarousel**: Fixed responsive mode stability when window is resized
- **VirtualCarousel**: Fixed circular dependency in computed properties causing scroll calculation issues
- **All Components**: Improved ResizeObserver cleanup to prevent potential memory leaks

### Added
- **VirtualCarousel**: Exported `ResponsiveBreakpoint` type for TypeScript users

### Improved
- Better memory management in all components with explicit observer cleanup
- More consistent scroll behavior respecting user's `behavior` option

## [0.0.2] - Previous release

Initial public release with core functionality.
