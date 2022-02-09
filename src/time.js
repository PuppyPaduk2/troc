function time(key, handler) {
  return (...args) => {
    console.time(key);

    const result = handler(...args);

    if (result instanceof Promise) {
      result.finally(() => console.timeEnd(key));
    } else {
      console.timeEnd(key);
    }

    return result;
  };
}

module.exports = { time };
