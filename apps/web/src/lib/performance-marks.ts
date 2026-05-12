let measureSequence = 0;

function getPerformanceApi() {
  const performanceApi = globalThis.performance;

  if (
    !performanceApi ||
    typeof performanceApi.mark !== "function" ||
    typeof performanceApi.measure !== "function"
  ) {
    return null;
  }

  return performanceApi;
}

export async function measureAsyncPerformance<TValue>(
  measureName: string,
  work: () => Promise<TValue>
) {
  const performanceApi = getPerformanceApi();

  if (!performanceApi) {
    return work();
  }

  const sequence = measureSequence;
  measureSequence += 1;
  const prefixedMeasureName = `bookmark:${measureName}`;
  const startMark = `${prefixedMeasureName}:start:${sequence}`;
  const endMark = `${prefixedMeasureName}:end:${sequence}`;

  performanceApi.mark(startMark);
  try {
    return await work();
  } finally {
    performanceApi.mark(endMark);
    performanceApi.measure(prefixedMeasureName, startMark, endMark);
    performanceApi.clearMarks?.(startMark);
    performanceApi.clearMarks?.(endMark);
  }
}
