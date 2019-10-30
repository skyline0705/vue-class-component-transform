module.exports = {
    roots: [
        'src/',
    ],
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
    testRegex: '(/__tests__/.*|(\\.|/)spec)\\.(tsx?)$',
    moduleFileExtensions: ['ts', 'js'],
    globals: {
        'ts-jest': {
            tsConfig: 'tsconfig.json',
        },
    },
    collectCoverage: false,
    collectCoverageFrom: [
        '**/*.ts',
        '!**/node_modules/**',
        '!**/test/**',
        '!**/dist/**',
    ],
    coverageDirectory: 'coverage',
    moduleNameMapper: {
    },
};
