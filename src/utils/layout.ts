export function toCssHeight(height: number | string): string {
  if (height === 'fill') return '100%'
  return typeof height === 'number' ? `${height}px` : height
}

export function createZeroHeightWarning(componentName: string) {
  let warned = false

  return (element: HTMLElement | undefined, height: number | string) => {
    const usesPercentageHeight =
      typeof height === 'string' &&
      (height === 'fill' || height.trim().endsWith('%'))

    if (
      !import.meta.env.DEV ||
      warned ||
      !element ||
      typeof height === 'number' ||
      !usesPercentageHeight ||
      element.clientHeight > 0
    ) {
      return
    }

    warned = true
    console.warn(
      `[${componentName}] The viewport resolved to 0px high. Percentage heights require a parent with an explicit height. Set the parent height or pass a numeric \`height\`.`,
    )
  }
}
