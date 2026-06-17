const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withMinimumDelay(action, minimumMs = 700) {
  const startedAt = performance.now();

  try {
    return await action();
  } finally {
    const remaining = minimumMs - (performance.now() - startedAt);
    if (remaining > 0) {
      await wait(remaining);
    }
  }
}
