import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  defineConfig({
 }),
  defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
    },
  }),
);
