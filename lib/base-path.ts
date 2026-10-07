/** Empty for the server build; /kopilka for the GitHub Pages export. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const publicPath = (path: string) => `${basePath}${path}`;
