# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
