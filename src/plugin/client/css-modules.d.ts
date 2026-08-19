/** CSS Modules type declaration (tsdown virtual css plugin). */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
