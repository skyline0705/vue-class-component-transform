export const vueClassComponentImport = {
    type: 'ImportDeclaration',
    specifiers: [
        {
            type: 'ImportSpecifier',
            imported: {
                type: 'Identifier',
                name: 'Component'
            },
            local: {
                type: 'Identifier',
                name: 'Component'
            }
        },
        {
            type: 'ImportSpecifier',
            imported: {
                type: 'Identifier',
                name: 'Models'
            },
            local: {
                type: 'Identifier',
                name: 'Models'
            }
        },
        {
            type: 'ImportSpecifier',
            imported: {
                type: 'Identifier',
                name: 'Meta'
            },
            local: {
                type: 'Identifier',
                name: 'Meta'
            }
        },
        {
            type: 'ImportSpecifier',
            imported: {
                type: 'Identifier',
                name: 'Vue'
            },
            local: {
                type: 'Identifier',
                name: 'Vue'
            }
        },
        {
            type: 'ImportSpecifier',
            imported: {
                type: 'Identifier',
                name: 'Mixins'
            },
            local: {
                type: 'Identifier',
                name: 'Mixins'
            }
        },
        {
            type: 'ImportSpecifier',
            imported: {
                type: 'Identifier',
                name: 'Inject'
            },
            local: {
                type: 'Identifier',
                name: 'Inject'
            }
        }
    ],
    source: {
        type: 'StringLiteral',
        extra: {
            rawValue: '@/utils/vue-decorators',
            raw: '@/utils/vue-decorators'
        },
        value: '@/utils/vue-decorators'
    },
};