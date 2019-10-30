import { ParserOptions } from "@babel/core";

export const parseOptions: ParserOptions = {
    sourceType: 'module',
    plugins: [
        [ 'decorators', { decoratorsBeforeExport: true }],
        'classProperties',
        'typescript',
    ]
};