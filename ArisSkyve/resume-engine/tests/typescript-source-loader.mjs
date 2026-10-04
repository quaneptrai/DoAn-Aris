// Node can strip TypeScript syntax in this repository, but unlike the Vite
// build it does not resolve extensionless relative imports to `.ts`. Keep the
// test-only resolver tiny and explicit so rule tests exercise source modules
// without generating or committing a second build artifact.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/[./][^/]+\.[a-z]+(?:[?#].*)?$/i.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch (error) {
      if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    }
  }
  return nextResolve(specifier, context);
}
