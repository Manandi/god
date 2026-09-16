export interface TiledPropertyValue {
  name: string;
  type: string;
  value: string | number | boolean;
}

export interface TiledObjectLike {
  properties?: TiledPropertyValue[];
}

export function getObjectProperties(obj: TiledObjectLike): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const prop of obj.properties ?? []) {
    result[prop.name] = prop.value;
  }
  return result;
}
