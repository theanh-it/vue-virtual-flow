# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
