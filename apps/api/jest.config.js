module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\.spec\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(@xenova/transformers|sharp)/)',
  ],
  moduleNameMapper: {
    '^@xenova/transformers$': '<rootDir>/../test/__mocks__/xenova-transformers.mock.ts',
    '^@nexoria/shared-types$': '<rootDir>/../shared/types/src',
    '^@nexoria/shared-utils$': '<rootDir>/../shared/utils/src',
  },
};
