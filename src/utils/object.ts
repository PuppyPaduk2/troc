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

export function removePropsByValue<Value extends object>(
  value: Value,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: any
): Value {
  const result = Object.assign({}, value);
  for (const [propName, propValue] of Object.entries(value)) {
    if (values.includes(propValue)) delete result[propName as keyof Value];
  }
  return result;
}

export function removePropsEmpty<Value extends object>(value: Value): Value {
  return removePropsByValue(value, [null, undefined, ""]);
}
