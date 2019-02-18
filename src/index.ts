import { resolve } from 'path';
import { readFileSync } from 'fs';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { vueClassComponentImport } from './consts';
import {
    ExportDefaultDeclaration,
    ClassDeclaration,
    ObjectExpression,
    ObjectProperty,
    SpreadElement,
    ObjectMethod,
    ArrayExpression,
    Identifier,
    CallExpression,
    Expression,
    StringLiteral,
    ReturnStatement,
    ClassProperty,
    ClassMethod,
    FunctionExpression,
} from '@babel/types';
// const filePath = process.argv.slice(2)[0];
// const fileFullPath = resolve(__dirname, filePath);
const fileFullPath = resolve(__dirname, '../examples/abc.js');
const file = readFileSync(fileFullPath).toString('utf-8');



const outputFullpath = resolve(__dirname, '../examples/abc.ts');
const outputFile = readFileSync(outputFullpath).toString('utf-8');
// @ts-ignore
const outputAst = parse(outputFile, {
    sourceType: 'module',
    plugins: [
        [ 'decorators', {decoratorsBeforeExport: true }],
        'classProperties',
        'typescript',
    ]
});

const outputExportDefaultDeclaration = outputAst.program.body.find(node => node.type === 'ExportDefaultDeclaration')  as ExportDefaultDeclaration;;





// @ts-ignore
const ast = parse(file, {
    sourceType: 'module',
    plugins: [
        [ 'decorators', {decoratorsBeforeExport: true }],
        'classProperties',
    ]
});

function generateSuperClass(mixins: ArrayExpression | null) {
    if (mixins === null) {
        return {
            type: 'Identifier',
            name: 'Vue',
        };
    }
    return {
        type: 'CallExpression',
        callee: {
            type: 'Identifier',
            name: 'Mixins',
        },
        arguments: mixins.elements,
    };
}

function getMixins(mixins: ObjectProperty | null) {
    if (mixins === null) {
        return null;
    }
    const elements = (mixins.value as ArrayExpression).elements.map(element => {
        return {
            type: 'Identifier',
            name: (element as Identifier).name,
        };
    });
    return {
        type: 'ArrayExpression',
        elements,
    } as ArrayExpression;
}

function getProp(
    type: string,
    objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[],
) {
    const index = objProperties.findIndex(prop => {
        if (prop.type === 'SpreadElement') {
            throw new Error(`Get prop not support type ${prop.type}`);
        }
        return prop.key.name === type;
    });
    if (index === -1) {
        return null;
    }
    return objProperties.splice(
        index,
        1,
    )[0] as ObjectProperty | ObjectMethod;
}

function getComponentArguments(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
    const components = getProp('components', objProperties);
    const directives = getProp('directives', objProperties);
    const watch = getProp('watch', objProperties);
    if (!components && !directives && !watch) {
        return null;
    }
    return [{
        type: 'ObjectExpression',
        properties: [components, directives, watch]
            .filter(item => !!item)
            .map(item => {
                return {
                    type: (item as ObjectProperty).type,
                    value: (item as ObjectProperty).value,
                    key: (item as ObjectProperty).key,
                };
            })
    }] as Expression[];
}

function generateComponentDecorator(componentArguments: Expression[] | null) {
    if (componentArguments === null) {
        return {
            type: 'Identifier',
            name: 'Component',
        };
    }
    return {
        type: 'CallExpression',
        callee: {
            type: 'Identifier',
            name: 'Component',
        },
        arguments: componentArguments,
    } as CallExpression
}
function kebabCase2PascalCase(name: string) {
    return name.slice(0, 1).toUpperCase()
        + name.replace(/-([a-z])/g, g => g[1].toUpperCase()).slice(1);
}

function generateName(name: string) {
    if (!name.includes('/')) {
        return kebabCase2PascalCase(name);
    }
    const lastSlashIndex = name.lastIndexOf('/');
    const lastDotIndex = name.lastIndexOf('.');
    return kebabCase2PascalCase(name.slice(lastSlashIndex + 1, lastDotIndex));
}

function transformData(data: ObjectMethod) {
    const nodes = data.body.body;
    if (nodes.some(node => node.type !== 'ReturnStatement')) {
        throw new Error('Data Block should has local statement!');
    }
    const node = (nodes[0] as ReturnStatement).argument as ObjectExpression;
    if (node.type !== 'ObjectExpression') {
        throw new Error('Return value should be an ObjectExpression');
    }
    return transformToClassBodyProp(node, 'ClassProperty');
}

const transformPropCallBackMap = {
    ClassProperty(item: ObjectProperty | ObjectMethod | SpreadElement) {
        if (item.type !== 'ObjectProperty') {
            throw new Error(`Transform data error, type '${item.type}' is not support`);
        }
        return {
            type: 'ClassProperty',
            static: false,
            key: (item as ObjectProperty).key,
            computed: false,
            value: {
                ...(item as ObjectProperty).value,
            }
        } as ClassProperty;
    },
    ClassMethod(item: ObjectProperty | ObjectMethod | SpreadElement) {
        if (item.type !== 'ObjectMethod') {
            throw new Error(`Transform methods error, type '${item.type}' is not support`);
        }
        return {
            type: 'ClassMethod',
            static: false,
            key: (item as ObjectMethod).key,
            computed: false,
            kind: 'method',
            generator: (item as ObjectMethod).generator,
            async: (item as ObjectMethod).async,
            params: (item as ObjectMethod).params,
            body: (item as ObjectMethod).body,
        } as ClassMethod;
    },
    ClassAccessProperty(item: ObjectProperty | ObjectMethod | SpreadElement) {
        if (item.type === 'SpreadElement') {
            throw new Error(`Transform computed error, type '${item.type}' is not support`);
        }
        const common = {
            type: 'ClassMethod',
            static: false,
            key: (item as ObjectMethod).key,
            computed: false,
        }
        if (item.type === 'ObjectMethod') {
            return {
                ...common,
                generator: (item as ObjectMethod).generator,
                async: (item as ObjectMethod).async,
                kind: 'get',
                params: (item as ObjectMethod).params,
                body: (item as ObjectMethod).body,
            } as ClassMethod;
        }
        const properties = (item.value as ObjectExpression).properties.map(item => {
            return {
                ...common,
                generator: (item as ObjectMethod).generator,
                async: (item as ObjectMethod).async,
                kind: (item as ObjectMethod | ObjectProperty).key.name,
                params: (item as ObjectMethod).params
                || ((item as ObjectProperty).value as FunctionExpression).params,
                body: (item as ObjectMethod).body
                    || ((item as ObjectProperty).value as FunctionExpression).body,
            } as ClassMethod;
        });
        return properties;
    }
}

function transformToClassBodyProp(
    node: ObjectExpression,
    type: 'ClassProperty' | 'ClassMethod',
    isAccessProp?: boolean
) {
    if (type === 'ClassMethod' && isAccessProp) {
        return node.properties.map(item => {
            return transformPropCallBackMap.ClassAccessProperty(item);
        }).reduce((list: ClassMethod[], item) => {
            return Array.isArray(item)
                ? [...list, ...item]
                : [...list, item];
        }, [] as ClassMethod[]);
    }
    return node.properties.map(item => {
        return transformPropCallBackMap[type](item);
    });
}

const transformPropsMap = {
    metaInfo(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const metaInfo = getProp('metaInfo', objProperties);
        if (!metaInfo) {
            return []
        }
        return [{
            ...metaInfo,
            type: metaInfo.type === 'ObjectProperty'
                ? 'ClassProperty'
                : 'ClassMethod',
            decorators: [{
                type: 'Decorator',
                expression: {
                    type: 'Identifier',
                    name: 'Meta'
                }
            }],
        } as ClassMethod | ClassProperty];
    },
    inject(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const inject = getProp('inject', objProperties);
        if (!inject) {
            return []
        }
        if (inject.type !== 'ObjectProperty') {
            throw new Error(`Transform inject error, type '${inject.type}' is not support`)
        }
        const elements = (inject.value as ArrayExpression).elements as StringLiteral[];
        if (!elements.length) {
            return [];
        }
        return elements.map(element => {
            return {
                type: 'ClassProperty',
                decorators: [{
                    type: 'Decorator',
                    expression: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'Inject'
                        },
                        arguments: [] as Expression[]
                    }
                }],
                static: false,
                key: {
                    type: 'Identifier',
                    name: element.value,
                },
                value: null,
            } as ClassProperty;
        });
    },
    models(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        const models = getProp('models', objProperties);
        if (!models) {
            return []
        }
        if (models.type !== 'ObjectProperty') {
            throw new Error(`Transform models error, type '${models.type}' is not support`)
        }
        return [{
            type: 'ClassProperty',
            decorators: [{
                type: 'Decorator',
                expression: {
                    type: 'CallExpression',
                    callee: {
                        type: 'Identifier',
                        name: 'Models'
                    },
                    arguments: [(models as ObjectProperty).value],
                }
            }],
            static: false,
            key: {
                type: 'Identifier',
                name: '$models',
            },
            value: null,
        } as ClassProperty];
    },
    data(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        return transformData(getProp('data', objProperties) as ObjectMethod);
    },
    methods(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        return transformToClassBodyProp(
            (getProp('methods', objProperties) as ObjectProperty).value as ObjectExpression,
            'ClassMethod'
        );
    },
    computed(objProperties: (ObjectMethod | ObjectProperty | SpreadElement)[]) {
        return transformToClassBodyProp(
            (getProp('computed', objProperties) as ObjectProperty).value as ObjectExpression,
            'ClassMethod',
            true,
        );
    },
}

type propType = keyof typeof transformPropsMap;

function transformObjectBasedComponentToClass(node: ExportDefaultDeclaration) {
    const objProperties = (node.declaration as ObjectExpression).properties;
    // 此处为了挂载class component方便，所以对原有properties做mutable操作
    const mixins = getMixins(getProp('mixins', objProperties) as ObjectProperty);
    const componentArguments = getComponentArguments(objProperties);
    const nameProperty = getProp('name', objProperties)  as ObjectProperty;
    const name = nameProperty && (nameProperty.value as StringLiteral).value
        || fileFullPath;

    const properties = Object.keys(transformPropsMap).map(key => {
        return transformPropsMap[key as propType](objProperties);
    }).reduce((prev, next) => [...prev, ...next]);

    const exportValue = {
        type: 'ExportDefaultDeclaration',
        declaration: {
            type: 'ClassDeclaration',
            decorators: [{
                type: 'Decorator',
                expression: generateComponentDecorator(componentArguments),
            }],
            id: {
                type: 'Identifier',
                name: generateName(name),
            },
            superClass: generateSuperClass(mixins),
            body: {
                type: 'ClassBody',
                body: properties,
            }
        } as ClassDeclaration,
    } as ExportDefaultDeclaration;
    return exportValue;
}

const exportDefaultDeclarationIndex = ast.program.body.findIndex(node => node.type === 'ExportDefaultDeclaration');
ast.program.body[exportDefaultDeclarationIndex] = transformObjectBasedComponentToClass(ast.program.body[exportDefaultDeclarationIndex] as ExportDefaultDeclaration);
// 全局那一堆import
// @ts-ignore
ast.program.body.unshift(vueClassComponentImport);
const output = generate(ast, {
    // 隐藏属性……先这么用着
    // @ts-ignore
    decoratorsBeforeExport: true,
});
console.log(output.code);