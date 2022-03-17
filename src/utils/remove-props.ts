export function removeProps<Obj extends object>(
  obj: Obj,
  ...keys: string[]
): Obj {
  const result = Object.assign({}, obj);

  for (const key of keys) {
    delete result[key];
  }

  return result;
}
