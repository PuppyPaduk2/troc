export function removeProps<Value extends object>(
  value: Value,
  ...keys: (keyof Value)[]
): Value {
  const result = Object.assign({}, value);

  for (const key of keys) {
    if (key in value) delete result[key];
  }

  return result;
}
