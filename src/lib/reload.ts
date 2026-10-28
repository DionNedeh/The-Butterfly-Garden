/**
 * Start the app again from what is stored, as after a restore in safe mode.
 *
 * Its own module so tests can see it was asked for: jsdom cannot navigate,
 * and `location.reload` cannot be replaced there.
 */
export function reloadApp(): void {
  window.location.reload()
}
