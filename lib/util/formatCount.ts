export const formatCount = (
  count: number,
  singular: string,
  plural: string = `${singular}s`,
) => `${count} ${count === 1 ? singular : plural}`;
