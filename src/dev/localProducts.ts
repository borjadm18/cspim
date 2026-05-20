export const loadLocalProducts = async <T>(
  normalize: (value: unknown) => T | null
): Promise<T[]> => {
  const response = await fetch(new URL('./all-products-cursor.json', import.meta.url));
  if (!response.ok) {
    throw new Error(`No se pudo cargar el archivo local de productos (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data.map(normalize).filter((item): item is T => Boolean(item));
};
